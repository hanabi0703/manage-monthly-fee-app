import type { SQLiteDatabase } from "expo-sqlite";
import { compareName } from "./format";

export type PaymentType = "MONTHLY" | "VISITOR";

/** Fixed per-visit fee for VISITOR-type payments. */
export const VISITOR_FEE = 1000;

export type Member = {
  id: string;
  name: string;
  createdAt: string;
};

export type Payment = {
  id: string;
  /** The practice day this payment is for. Empty for a 不足金支払い
   * (shortfall payment), which isn't tied to any specific day — only
   * `createdAt` (the day it was actually paid) is recorded for those. */
  date: string;
  memberId: string;
  amount: number;
  type: PaymentType;
  createdAt: string;
};

export type PaymentWithMember = Payment & { memberName: string };

export type PracticeDay = {
  id: string;
  date: string;
  createdAt: string;
};

export type Attendance = {
  id: string;
  date: string;
  memberId: string;
  createdAt: string;
};

export type MonthSummary = {
  month: string;
  practiceDayCount: number;
  totalCollected: number;
  paymentCount: number;
};

function generateId(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

/** Thrown when attempting to modify data belonging to an approved (locked) month. */
export class MonthLockedError extends Error {
  month: string;
  constructor(month: string) {
    super(`${month} is approved and locked.`);
    this.name = "MonthLockedError";
    this.month = month;
  }
}

async function assertMonthNotLocked(db: SQLiteDatabase, month: string): Promise<void> {
  if (!month) return;
  if (await isMonthApproved(db, month)) {
    throw new MonthLockedError(month);
  }
}

export async function migrateDbIfNeeded(db: SQLiteDatabase) {
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS members (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS fee_settings (
      id TEXT PRIMARY KEY NOT NULL,
      amount INTEGER NOT NULL,
      effective_from TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS payments (
      id TEXT PRIMARY KEY NOT NULL,
      date TEXT NOT NULL,
      member_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
      amount INTEGER NOT NULL,
      type TEXT NOT NULL CHECK (type IN ('MONTHLY', 'VISITOR')),
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_payments_date ON payments(date);
    CREATE INDEX IF NOT EXISTS idx_payments_member ON payments(member_id);

    CREATE TABLE IF NOT EXISTS practice_days (
      id TEXT PRIMARY KEY NOT NULL,
      date TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_practice_days_date ON practice_days(date);

    CREATE TABLE IF NOT EXISTS attendance (
      id TEXT PRIMARY KEY NOT NULL,
      date TEXT NOT NULL,
      member_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
      type TEXT NOT NULL CHECK (type IN ('MONTHLY', 'VISITOR')),
      created_at TEXT NOT NULL,
      UNIQUE (date, member_id)
    );

    CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance(date);
    CREATE INDEX IF NOT EXISTS idx_attendance_member ON attendance(member_id);

    CREATE TABLE IF NOT EXISTS base_fee_setting (
      id TEXT PRIMARY KEY NOT NULL,
      amount INTEGER NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS month_fee_overrides (
      id TEXT PRIMARY KEY NOT NULL,
      month TEXT NOT NULL UNIQUE,
      amount INTEGER NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS member_month_status (
      id TEXT PRIMARY KEY NOT NULL,
      member_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
      month TEXT NOT NULL,
      type TEXT NOT NULL CHECK (type IN ('MONTHLY', 'VISITOR')),
      created_at TEXT NOT NULL,
      UNIQUE (member_id, month)
    );

    CREATE TABLE IF NOT EXISTS month_approvals (
      month TEXT PRIMARY KEY NOT NULL,
      approved_at TEXT NOT NULL
    );
  `);

  const baseFeeCount = await db.getFirstAsync<{ count: number }>(
    "SELECT COUNT(*) as count FROM base_fee_setting",
  );
  if ((baseFeeCount?.count ?? 0) === 0) {
    const latestLegacyFee = await db.getFirstAsync<{ amount: number }>(
      "SELECT amount FROM fee_settings ORDER BY effective_from DESC LIMIT 1",
    );
    await db.runAsync(
      "INSERT INTO base_fee_setting (id, amount, updated_at) VALUES (?, ?, ?)",
      generateId(),
      latestLegacyFee?.amount ?? 5000,
      new Date().toISOString(),
    );
  }
}

export async function listMembers(db: SQLiteDatabase): Promise<Member[]> {
  const rows = await db.getAllAsync<{
    id: string;
    name: string;
    created_at: string;
  }>("SELECT id, name, created_at FROM members");
  // SQLiteのORDER BYはUnicodeコードポイント順(バイナリ比較)のため、
  // ひらがな/カタカナ/漢字が混在すると五十音順にならない。
  // compareNameでロケールを考慮した順序に並べ替える。
  return rows
    .map((r) => ({ id: r.id, name: r.name, createdAt: r.created_at }))
    .sort((a, b) => compareName(a.name, b.name));
}

export async function upsertMemberByName(
  db: SQLiteDatabase,
  name: string,
): Promise<Member> {
  const trimmed = name.trim();
  const existing = await db.getFirstAsync<{
    id: string;
    name: string;
    created_at: string;
  }>("SELECT id, name, created_at FROM members WHERE name = ?", trimmed);
  if (existing) {
    return { id: existing.id, name: existing.name, createdAt: existing.created_at };
  }
  const id = generateId();
  const createdAt = new Date().toISOString();
  await db.runAsync(
    "INSERT INTO members (id, name, created_at) VALUES (?, ?, ?)",
    id,
    trimmed,
    createdAt,
  );
  return { id, name: trimmed, createdAt };
}

export async function getMember(
  db: SQLiteDatabase,
  id: string,
): Promise<Member | null> {
  const row = await db.getFirstAsync<{
    id: string;
    name: string;
    created_at: string;
  }>("SELECT id, name, created_at FROM members WHERE id = ?", id);
  return row ? { id: row.id, name: row.name, createdAt: row.created_at } : null;
}

export async function deleteMember(db: SQLiteDatabase, id: string): Promise<void> {
  await db.runAsync("DELETE FROM members WHERE id = ?", id);
}

export async function listPayments(
  db: SQLiteDatabase,
): Promise<PaymentWithMember[]> {
  const rows = await db.getAllAsync<{
    id: string;
    date: string;
    member_id: string;
    amount: number;
    type: PaymentType;
    created_at: string;
    member_name: string;
  }>(
    `SELECT p.id, p.date, p.member_id, p.amount, p.type, p.created_at, m.name as member_name
     FROM payments p JOIN members m ON m.id = p.member_id
     ORDER BY p.date DESC, p.created_at DESC`,
  );
  return rows.map((r) => ({
    id: r.id,
    date: r.date,
    memberId: r.member_id,
    amount: r.amount,
    type: r.type,
    createdAt: r.created_at,
    memberName: r.member_name,
  }));
}

export async function listPaymentsForMember(
  db: SQLiteDatabase,
  memberId: string,
): Promise<Payment[]> {
  const rows = await db.getAllAsync<{
    id: string;
    date: string;
    member_id: string;
    amount: number;
    type: PaymentType;
    created_at: string;
  }>(
    "SELECT id, date, member_id, amount, type, created_at FROM payments WHERE member_id = ? ORDER BY date DESC, created_at DESC",
    memberId,
  );
  return rows.map((r) => ({
    id: r.id,
    date: r.date,
    memberId: r.member_id,
    amount: r.amount,
    type: r.type,
    createdAt: r.created_at,
  }));
}

export async function listPaymentsForDate(
  db: SQLiteDatabase,
  date: string,
): Promise<PaymentWithMember[]> {
  const rows = await db.getAllAsync<{
    id: string;
    date: string;
    member_id: string;
    amount: number;
    type: PaymentType;
    created_at: string;
    member_name: string;
  }>(
    `SELECT p.id, p.date, p.member_id, p.amount, p.type, p.created_at, m.name as member_name
     FROM payments p JOIN members m ON m.id = p.member_id
     WHERE p.date = ?
     ORDER BY m.name ASC`,
    date,
  );
  return rows.map((r) => ({
    id: r.id,
    date: r.date,
    memberId: r.member_id,
    amount: r.amount,
    type: r.type,
    createdAt: r.created_at,
    memberName: r.member_name,
  }));
}

export async function deletePayment(
  db: SQLiteDatabase,
  id: string,
): Promise<void> {
  const row = await db.getFirstAsync<{ date: string; created_at: string }>(
    "SELECT date, created_at FROM payments WHERE id = ?",
    id,
  );
  if (row) {
    // 不足金支払い(dateが空欄)は支払った月(created_at)を対象月として扱う
    // (会計表での集計と同じ基準)。
    const effectiveMonth = (row.date || row.created_at).slice(0, 7);
    await assertMonthNotLocked(db, effectiveMonth);
  }
  await db.runAsync("DELETE FROM payments WHERE id = ?", id);
}

/** The base (default) monthly fee, used for any month without an exception amount. */
export async function getBaseFee(db: SQLiteDatabase): Promise<number> {
  const row = await db.getFirstAsync<{ amount: number }>(
    "SELECT amount FROM base_fee_setting LIMIT 1",
  );
  return row?.amount ?? 0;
}

export async function setBaseFee(db: SQLiteDatabase, amount: number): Promise<void> {
  const row = await db.getFirstAsync<{ id: string }>(
    "SELECT id FROM base_fee_setting LIMIT 1",
  );
  if (row) {
    await db.runAsync(
      "UPDATE base_fee_setting SET amount = ?, updated_at = ? WHERE id = ?",
      amount,
      new Date().toISOString(),
      row.id,
    );
  } else {
    await db.runAsync(
      "INSERT INTO base_fee_setting (id, amount, updated_at) VALUES (?, ?, ?)",
      generateId(),
      amount,
      new Date().toISOString(),
    );
  }
}

/** A month ("YYYY-MM") that has its own exception fee amount, overriding the base fee just for that month. */
export async function getMonthFeeOverride(
  db: SQLiteDatabase,
  month: string,
): Promise<number | null> {
  const row = await db.getFirstAsync<{ amount: number }>(
    "SELECT amount FROM month_fee_overrides WHERE month = ?",
    month,
  );
  return row?.amount ?? null;
}

export async function setMonthFeeOverride(
  db: SQLiteDatabase,
  month: string,
  amount: number,
): Promise<void> {
  await assertMonthNotLocked(db, month);
  await db.runAsync("DELETE FROM month_fee_overrides WHERE month = ?", month);
  await db.runAsync(
    "INSERT INTO month_fee_overrides (id, month, amount, created_at) VALUES (?, ?, ?, ?)",
    generateId(),
    month,
    amount,
    new Date().toISOString(),
  );
}

export async function clearMonthFeeOverride(
  db: SQLiteDatabase,
  month: string,
): Promise<void> {
  await assertMonthNotLocked(db, month);
  await db.runAsync("DELETE FROM month_fee_overrides WHERE month = ?", month);
}

/** The fee that applies for a given month: its exception amount if set, otherwise the base fee. */
export async function getFeeForMonth(db: SQLiteDatabase, month: string): Promise<number> {
  const override = await getMonthFeeOverride(db, month);
  if (override !== null) return override;
  return getBaseFee(db);
}

/** Fee-per-month lookup for a set of months, in one round trip (base fee + all overrides). */
export async function getFeeForMonths(
  db: SQLiteDatabase,
  months: string[],
): Promise<Record<string, number>> {
  const [base, overrides] = await Promise.all([
    getBaseFee(db),
    db.getAllAsync<{ month: string; amount: number }>(
      "SELECT month, amount FROM month_fee_overrides",
    ),
  ]);
  const overrideMap = new Map(overrides.map((o) => [o.month, o.amount]));
  const result: Record<string, number> = {};
  for (const month of months) {
    result[month] = overrideMap.get(month) ?? base;
  }
  return result;
}

export async function updateMemberName(
  db: SQLiteDatabase,
  id: string,
  name: string,
): Promise<void> {
  await db.runAsync("UPDATE members SET name = ? WHERE id = ?", name.trim(), id);
}

/**
 * Whether a member is a monthly-dues payer or a visitor for a given month
 * ("YYYY-MM"). Decided once at the start of the month; defaults to MONTHLY
 * when nothing has been set yet.
 */
export async function getMemberMonthStatus(
  db: SQLiteDatabase,
  memberId: string,
  month: string,
): Promise<PaymentType> {
  const row = await db.getFirstAsync<{ type: PaymentType }>(
    "SELECT type FROM member_month_status WHERE member_id = ? AND month = ?",
    memberId,
    month,
  );
  return row?.type ?? "MONTHLY";
}

export async function listMemberMonthStatusForMonth(
  db: SQLiteDatabase,
  month: string,
): Promise<Record<string, PaymentType>> {
  const rows = await db.getAllAsync<{ member_id: string; type: PaymentType }>(
    "SELECT member_id, type FROM member_month_status WHERE month = ?",
    month,
  );
  const result: Record<string, PaymentType> = {};
  for (const row of rows) {
    result[row.member_id] = row.type;
  }
  return result;
}

export async function setMemberMonthStatus(
  db: SQLiteDatabase,
  input: { memberId: string; month: string; type: PaymentType },
): Promise<void> {
  await assertMonthNotLocked(db, input.month);
  await db.runAsync(
    "DELETE FROM member_month_status WHERE member_id = ? AND month = ?",
    input.memberId,
    input.month,
  );
  await db.runAsync(
    "INSERT INTO member_month_status (id, member_id, month, type, created_at) VALUES (?, ?, ?, ?, ?)",
    generateId(),
    input.memberId,
    input.month,
    input.type,
    new Date().toISOString(),
  );
}

export async function createPaymentForMember(
  db: SQLiteDatabase,
  input: {
    memberId: string;
    date: string;
    amount: number;
    type: PaymentType;
  },
): Promise<void> {
  // 不足金支払い(dateが空欄)は支払った月(=今日の月)を対象月として扱う
  // (会計表での集計と同じ基準)。
  const effectiveMonth = input.date ? input.date.slice(0, 7) : new Date().toISOString().slice(0, 7);
  await assertMonthNotLocked(db, effectiveMonth);
  await db.runAsync(
    "INSERT INTO payments (id, date, member_id, amount, type, created_at) VALUES (?, ?, ?, ?, ?, ?)",
    generateId(),
    input.date,
    input.memberId,
    input.amount,
    input.type,
    new Date().toISOString(),
  );
}

export async function listPracticeDays(
  db: SQLiteDatabase,
): Promise<PracticeDay[]> {
  const rows = await db.getAllAsync<{
    id: string;
    date: string;
    created_at: string;
  }>("SELECT id, date, created_at FROM practice_days ORDER BY date ASC");
  return rows.map((r) => ({ id: r.id, date: r.date, createdAt: r.created_at }));
}

export async function listPracticeDaysForMonth(
  db: SQLiteDatabase,
  month: string,
): Promise<PracticeDay[]> {
  const rows = await db.getAllAsync<{
    id: string;
    date: string;
    created_at: string;
  }>(
    "SELECT id, date, created_at FROM practice_days WHERE date LIKE ? ORDER BY date ASC",
    `${month}-%`,
  );
  return rows.map((r) => ({ id: r.id, date: r.date, createdAt: r.created_at }));
}

export async function addPracticeDay(
  db: SQLiteDatabase,
  date: string,
): Promise<void> {
  await db.runAsync(
    "INSERT OR IGNORE INTO practice_days (id, date, created_at) VALUES (?, ?, ?)",
    generateId(),
    date,
    new Date().toISOString(),
  );
}

export async function deletePracticeDay(
  db: SQLiteDatabase,
  id: string,
): Promise<void> {
  await db.runAsync("DELETE FROM practice_days WHERE id = ?", id);
}

export async function listAttendanceForDate(
  db: SQLiteDatabase,
  date: string,
): Promise<Attendance[]> {
  const rows = await db.getAllAsync<{
    id: string;
    date: string;
    member_id: string;
    created_at: string;
  }>(
    "SELECT id, date, member_id, created_at FROM attendance WHERE date = ?",
    date,
  );
  return rows.map((r) => ({
    id: r.id,
    date: r.date,
    memberId: r.member_id,
    createdAt: r.created_at,
  }));
}

export async function listAttendance(db: SQLiteDatabase): Promise<Attendance[]> {
  const rows = await db.getAllAsync<{
    id: string;
    date: string;
    member_id: string;
    created_at: string;
  }>("SELECT id, date, member_id, created_at FROM attendance");
  return rows.map((r) => ({
    id: r.id,
    date: r.date,
    memberId: r.member_id,
    createdAt: r.created_at,
  }));
}

export async function listAttendanceForMember(
  db: SQLiteDatabase,
  memberId: string,
): Promise<Attendance[]> {
  const rows = await db.getAllAsync<{
    id: string;
    date: string;
    member_id: string;
    created_at: string;
  }>(
    "SELECT id, date, member_id, created_at FROM attendance WHERE member_id = ?",
    memberId,
  );
  return rows.map((r) => ({
    id: r.id,
    date: r.date,
    memberId: r.member_id,
    createdAt: r.created_at,
  }));
}

/** Every month ("YYYY-MM") this member has an explicit MONTHLY/VISITOR classification for. */
export async function listMemberMonthStatusForMember(
  db: SQLiteDatabase,
  memberId: string,
): Promise<Record<string, PaymentType>> {
  const rows = await db.getAllAsync<{ month: string; type: PaymentType }>(
    "SELECT month, type FROM member_month_status WHERE member_id = ?",
    memberId,
  );
  const result: Record<string, PaymentType> = {};
  for (const row of rows) {
    result[row.month] = row.type;
  }
  return result;
}

/**
 * Every (memberId, date) where the member attended, was classified as
 * VISITOR for that date's month, and has no matching VISITOR payment for
 * that exact date yet.
 */
export async function listUnpaidVisitorAttendance(
  db: SQLiteDatabase,
): Promise<{ memberId: string; date: string }[]> {
  const rows = await db.getAllAsync<{ member_id: string; date: string }>(
    `SELECT a.member_id, a.date
     FROM attendance a
     LEFT JOIN member_month_status mms
       ON mms.member_id = a.member_id AND mms.month = substr(a.date, 1, 7)
     LEFT JOIN payments p
       ON p.member_id = a.member_id AND p.date = a.date AND p.type = 'VISITOR'
     WHERE COALESCE(mms.type, 'MONTHLY') = 'VISITOR' AND p.id IS NULL`,
  );
  return rows.map((r) => ({ memberId: r.member_id, date: r.date }));
}

export async function setAttendance(
  db: SQLiteDatabase,
  input: { memberId: string; date: string },
): Promise<void> {
  await assertMonthNotLocked(db, input.date.slice(0, 7));
  await db.runAsync(
    "DELETE FROM attendance WHERE date = ? AND member_id = ?",
    input.date,
    input.memberId,
  );
  await db.runAsync(
    // `type` is a vestigial NOT NULL column from an earlier schema; always
    // written as MONTHLY since attendance no longer carries a type itself.
    "INSERT INTO attendance (id, date, member_id, type, created_at) VALUES (?, ?, ?, 'MONTHLY', ?)",
    generateId(),
    input.date,
    input.memberId,
    new Date().toISOString(),
  );
}

export async function removeAttendance(
  db: SQLiteDatabase,
  input: { memberId: string; date: string },
): Promise<void> {
  await assertMonthNotLocked(db, input.date.slice(0, 7));
  await db.runAsync(
    "DELETE FROM attendance WHERE date = ? AND member_id = ?",
    input.date,
    input.memberId,
  );
}

/** Distinct months (from practice days, attendance, and payments) with a summary for each. */
export async function listMonths(db: SQLiteDatabase): Promise<MonthSummary[]> {
  const [practiceDays, payments, attendance] = await Promise.all([
    listPracticeDays(db),
    listPayments(db),
    listAttendance(db),
  ]);

  const byMonth = new Map<string, MonthSummary>();
  function ensure(month: string): MonthSummary {
    let summary = byMonth.get(month);
    if (!summary) {
      summary = { month, practiceDayCount: 0, totalCollected: 0, paymentCount: 0 };
      byMonth.set(month, summary);
    }
    return summary;
  }

  for (const d of practiceDays) {
    ensure(d.date.slice(0, 7)).practiceDayCount += 1;
  }
  for (const a of attendance) {
    ensure(a.date.slice(0, 7));
  }
  for (const p of payments) {
    const summary = ensure(p.date.slice(0, 7));
    summary.totalCollected += p.amount;
    summary.paymentCount += 1;
  }

  return Array.from(byMonth.values()).sort((a, b) => b.month.localeCompare(a.month));
}

/**
 * A month ("YYYY-MM") that has been marked 承認済み (approved/closed). Once
 * approved, that month's payments, attendance, member classification, and
 * fee override can no longer be changed (see `assertMonthNotLocked`).
 */
export async function isMonthApproved(db: SQLiteDatabase, month: string): Promise<boolean> {
  if (!month) return false;
  const row = await db.getFirstAsync<{ month: string }>(
    "SELECT month FROM month_approvals WHERE month = ?",
    month,
  );
  return !!row;
}

export async function approveMonth(db: SQLiteDatabase, month: string): Promise<void> {
  await db.runAsync(
    "INSERT OR IGNORE INTO month_approvals (month, approved_at) VALUES (?, ?)",
    month,
    new Date().toISOString(),
  );
}
