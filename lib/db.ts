import type { SQLiteDatabase } from "expo-sqlite";
import { standardFeeAt } from "@/lib/balance";

export type PaymentType = "MONTHLY" | "VISITOR";

export type Member = {
  id: string;
  name: string;
  createdAt: string;
};

export type FeeSetting = {
  id: string;
  amount: number;
  effectiveFrom: string;
  createdAt: string;
};

export type Payment = {
  id: string;
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

export type MonthSummary = {
  month: string;
  practiceDayCount: number;
  totalCollected: number;
  paymentCount: number;
};

function generateId(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
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
  `);

  const existing = await db.getFirstAsync<{ count: number }>(
    "SELECT COUNT(*) as count FROM fee_settings",
  );
  if ((existing?.count ?? 0) === 0) {
    await db.runAsync(
      "INSERT INTO fee_settings (id, amount, effective_from, created_at) VALUES (?, ?, ?, ?)",
      generateId(),
      5000,
      todayIso(),
      new Date().toISOString(),
    );
  }
}

export async function listMembers(db: SQLiteDatabase): Promise<Member[]> {
  const rows = await db.getAllAsync<{
    id: string;
    name: string;
    created_at: string;
  }>("SELECT id, name, created_at FROM members ORDER BY name ASC");
  return rows.map((r) => ({ id: r.id, name: r.name, createdAt: r.created_at }));
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

export async function deletePayment(
  db: SQLiteDatabase,
  id: string,
): Promise<void> {
  await db.runAsync("DELETE FROM payments WHERE id = ?", id);
}

export async function listFeeSettings(
  db: SQLiteDatabase,
): Promise<FeeSetting[]> {
  const rows = await db.getAllAsync<{
    id: string;
    amount: number;
    effective_from: string;
    created_at: string;
  }>(
    "SELECT id, amount, effective_from, created_at FROM fee_settings ORDER BY effective_from ASC",
  );
  return rows.map((r) => ({
    id: r.id,
    amount: r.amount,
    effectiveFrom: r.effective_from,
    createdAt: r.created_at,
  }));
}

export async function addFeeSetting(
  db: SQLiteDatabase,
  input: { amount: number; effectiveFrom: string },
): Promise<void> {
  await db.runAsync(
    "INSERT INTO fee_settings (id, amount, effective_from, created_at) VALUES (?, ?, ?, ?)",
    generateId(),
    input.amount,
    input.effectiveFrom,
    new Date().toISOString(),
  );
}

export async function getCurrentFee(db: SQLiteDatabase): Promise<number> {
  const settings = await listFeeSettings(db);
  return standardFeeAt(todayIso(), settings);
}

export async function updateMemberName(
  db: SQLiteDatabase,
  id: string,
  name: string,
): Promise<void> {
  await db.runAsync("UPDATE members SET name = ? WHERE id = ?", name.trim(), id);
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

/** Distinct months (from practice days and payments) with a summary for each. */
export async function listMonths(db: SQLiteDatabase): Promise<MonthSummary[]> {
  const [practiceDays, payments] = await Promise.all([
    listPracticeDays(db),
    listPayments(db),
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
  for (const p of payments) {
    const summary = ensure(p.date.slice(0, 7));
    summary.totalCollected += p.amount;
    summary.paymentCount += 1;
  }

  return Array.from(byMonth.values()).sort((a, b) => b.month.localeCompare(a.month));
}
