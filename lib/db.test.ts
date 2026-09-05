import type { SQLiteDatabase } from "expo-sqlite";
import { createRawTestDb, createTestDb } from "./__tests__/testDb";
import * as dbModule from "./db";
import {
  addPracticeDay,
  approveMonth,
  cancelPayment,
  clearMonthFeeOverride,
  createPaymentForMember,
  deleteMember,
  deletePracticeDay,
  getBaseFee,
  getFeeForMonth,
  getFeeForMonths,
  getMember,
  getMemberMonthStatus,
  getMonthFeeOverride,
  isMonthApproved,
  listAttendanceForDate,
  listAttendanceForMember,
  listMemberMonthStatusForMember,
  listMemberMonthStatusForMonth,
  listMembers,
  listMonths,
  listPayments,
  listPaymentsForDate,
  listPaymentsForMember,
  listPracticeDays,
  listPracticeDaysForMonth,
  listUnpaidVisitorAttendance,
  listWithdrawnMembers,
  migrateDbIfNeeded,
  MonthLockedError,
  removeAttendance,
  setAttendance,
  setBaseFee,
  setMemberMonthStatus,
  setMonthFeeOverride,
  updateMember,
  updateMemberStatus,
  upsertMember,
} from "./db";

let db: SQLiteDatabase;

beforeEach(async () => {
  db = await createTestDb();
});

afterEach(() => {
  jest.useRealTimers();
});

// ---------------------------------------------------------------------------
// 5.1 MonthLockedError
// ---------------------------------------------------------------------------
describe("MonthLockedError", () => {
  test("DB-001: message/name/monthが正しく設定される", () => {
    const err = new MonthLockedError("2026-04");
    expect(err.message).toBe("2026-04 is approved and locked.");
    expect(err.name).toBe("MonthLockedError");
    expect(err.month).toBe("2026-04");
  });
});

// ---------------------------------------------------------------------------
// 5.2 migrateDbIfNeeded
// ---------------------------------------------------------------------------
describe("migrateDbIfNeeded", () => {
  test("DB-002: 初回実行で全テーブルが作成される", async () => {
    const raw = createRawTestDb();
    await migrateDbIfNeeded(raw);
    const tables = await raw.getAllAsync<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type='table'",
    );
    const names = tables.map((t) => t.name);
    for (const expected of [
      "members",
      "payments",
      "practice_days",
      "attendance",
      "base_fee_setting",
      "month_fee_overrides",
      "member_month_status",
      "month_approvals",
    ]) {
      expect(names).toContain(expected);
    }
  });

  test("DB-003: 旧fee_settingsの値がbase_fee_settingへ1回だけ引き継がれる", async () => {
    const raw = createRawTestDb();
    await raw.execAsync(`
      CREATE TABLE fee_settings (
        id TEXT PRIMARY KEY NOT NULL,
        amount INTEGER NOT NULL,
        effective_from TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
    `);
    await raw.runAsync(
      "INSERT INTO fee_settings (id, amount, effective_from, created_at) VALUES (?, ?, ?, ?)",
      "legacy1",
      4500,
      "2025-01-01",
      "2025-01-01T00:00:00.000Z",
    );
    await migrateDbIfNeeded(raw);
    const base = await raw.getFirstAsync<{ amount: number }>(
      "SELECT amount FROM base_fee_setting LIMIT 1",
    );
    expect(base?.amount).toBe(4500);
  });

  test("DB-004: fee_settingsが空ならデフォルト5000が採用される", async () => {
    const raw = createRawTestDb();
    await migrateDbIfNeeded(raw);
    const base = await raw.getFirstAsync<{ amount: number }>(
      "SELECT amount FROM base_fee_setting LIMIT 1",
    );
    expect(base?.amount).toBe(5000);
  });

  test("DB-005: 既にbase_fee_settingがある状態で再実行しても上書きされない", async () => {
    await setBaseFee(db, 7777);
    await migrateDbIfNeeded(db);
    const rows = await db.getAllAsync<{ amount: number }>("SELECT amount FROM base_fee_setting");
    expect(rows).toHaveLength(1);
    expect(rows[0].amount).toBe(7777);
  });

  test("DB-006: 旧members(furigana/status列なし)にfurigana/statusが追加される", async () => {
    const raw = createRawTestDb();
    await raw.execAsync(`
      CREATE TABLE members (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL UNIQUE,
        created_at TEXT NOT NULL
      );
    `);
    await raw.runAsync(
      "INSERT INTO members (id, name, created_at) VALUES (?, ?, ?)",
      "m1",
      "山田太郎",
      "2025-01-01T00:00:00.000Z",
    );
    await migrateDbIfNeeded(raw);
    const row = await raw.getFirstAsync<{ furigana: string; status: string }>(
      "SELECT furigana, status FROM members WHERE id = ?",
      "m1",
    );
    expect(row?.furigana).toBe("");
    expect(row?.status).toBe("ACTIVE");
  });

  test("DB-007: 新スキーマに対して2回連続実行してもエラーにならず変化しない", async () => {
    await expect(migrateDbIfNeeded(db)).resolves.not.toThrow();
    const columns = await db.getAllAsync<{ name: string }>("PRAGMA table_info(members)");
    const names = columns.map((c) => c.name).sort();
    expect(names).toEqual(["created_at", "furigana", "id", "name", "status"].sort());
  });

  test("DB-008: note/cancels_payment_id列の無いpaymentsに両列が追加される", async () => {
    const raw = createRawTestDb();
    await raw.execAsync(`
      CREATE TABLE members (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL UNIQUE,
        created_at TEXT NOT NULL
      );
      CREATE TABLE payments (
        id TEXT PRIMARY KEY NOT NULL,
        date TEXT NOT NULL,
        member_id TEXT NOT NULL,
        amount INTEGER NOT NULL,
        type TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
    `);
    await migrateDbIfNeeded(raw);
    const columns = await raw.getAllAsync<{ name: string }>("PRAGMA table_info(payments)");
    const names = columns.map((c) => c.name);
    expect(names).toContain("note");
    expect(names).toContain("cancels_payment_id");
  });
});

// ---------------------------------------------------------------------------
// 5.3 メンバー管理
// ---------------------------------------------------------------------------
describe("メンバー管理", () => {
  test("DB-009: listMembersはWITHDRAWN以外のみ返す", async () => {
    const active = await upsertAndSetStatus("田中", "タナカ", "ACTIVE");
    const leave = await upsertAndSetStatus("佐藤", "サトウ", "ON_LEAVE");
    await upsertAndSetStatus("鈴木", "スズキ", "WITHDRAWN");

    const rows = await listMembers(db);
    const ids = rows.map((r) => r.id).sort();
    expect(ids).toEqual([active.id, leave.id].sort());
  });

  test("DB-010: listMembersはふりがなの五十音順で返る(SQLiteのバイナリ順ではない)", async () => {
    await upsertAndSetStatus("田中", "タナカ", "ACTIVE");
    await upsertAndSetStatus("愛上", "アイウエ", "ACTIVE");
    await upsertAndSetStatus("山田", "ヤマダ", "ACTIVE");

    const rows = await listMembers(db);
    expect(rows.map((r) => r.furigana)).toEqual(["アイウエ", "タナカ", "ヤマダ"]);
  });

  test("DB-011: listWithdrawnMembersはWITHDRAWNのみふりがな順で返る", async () => {
    await upsertAndSetStatus("田中", "タナカ", "WITHDRAWN");
    await upsertAndSetStatus("愛上", "アイウエ", "WITHDRAWN");
    await upsertAndSetStatus("山田", "ヤマダ", "ACTIVE");

    const rows = await listWithdrawnMembers(db);
    expect(rows.map((r) => r.furigana)).toEqual(["アイウエ", "タナカ"]);
  });

  test("DB-012: upsertMemberで新規作成される", async () => {
    const m = await upsertMemberHelper("山田太郎", "ヤマダタロウ");
    expect(m.status).toBe("ACTIVE");
    expect(m.name).toBe("山田太郎");
  });

  test("DB-013: 同名を再度upsertしても新規作成されない", async () => {
    const first = await upsertMemberHelper("山田太郎", "ヤマダタロウ");
    const second = await upsertMemberHelper("山田太郎", "ヤマダタロウ");
    expect(second.id).toBe(first.id);
    const rows = await listMembers(db);
    expect(rows).toHaveLength(1);
  });

  test("DB-014: 前後空白がtrimされて保存される", async () => {
    const m = await upsertMemberHelper("  山田太郎  ", "  ヤマダタロウ  ");
    expect(m.name).toBe("山田太郎");
    expect(m.furigana).toBe("ヤマダタロウ");
  });

  test("DB-015: getMemberは存在時はMemberを、非存在時はnullを返す", async () => {
    const m = await upsertMemberHelper("山田太郎", "ヤマダタロウ");
    expect((await getMember(db, m.id))?.id).toBe(m.id);
    expect(await getMember(db, "not-exist")).toBeNull();
  });

  test("DB-016: deleteMemberでON DELETE CASCADEにより関連レコードも削除される", async () => {
    await addPracticeDay(db, "2026-04-05");
    const m = await upsertMemberHelper("山田太郎", "ヤマダタロウ");
    await createPaymentForMember(db, { memberId: m.id, date: "2026-04-05", amount: 5000, type: "MONTHLY" });
    await setAttendance(db, { memberId: m.id, date: "2026-04-05" });

    await deleteMember(db, m.id);

    expect(await getMember(db, m.id)).toBeNull();
    expect(await listPaymentsForMember(db, m.id)).toHaveLength(0);
    expect(await listAttendanceForMember(db, m.id)).toHaveLength(0);
  });

  test("DB-017: updateMemberでtrimされた値が保存される", async () => {
    const m = await upsertMemberHelper("山田太郎", "ヤマダタロウ");
    await updateMember(db, m.id, { name: "  鈴木一郎  ", furigana: "  スズキイチロウ  " });
    const updated = await getMember(db, m.id);
    expect(updated?.name).toBe("鈴木一郎");
    expect(updated?.furigana).toBe("スズキイチロウ");
  });

  test("DB-018: updateMemberStatusで状態が順に更新される", async () => {
    const m = await upsertMemberHelper("山田太郎", "ヤマダタロウ");
    await updateMemberStatus(db, m.id, "ON_LEAVE");
    expect((await getMember(db, m.id))?.status).toBe("ON_LEAVE");
    await updateMemberStatus(db, m.id, "WITHDRAWN");
    expect((await getMember(db, m.id))?.status).toBe("WITHDRAWN");
    await updateMemberStatus(db, m.id, "ACTIVE");
    expect((await getMember(db, m.id))?.status).toBe("ACTIVE");
  });

  async function upsertMemberHelper(name: string, furigana: string) {
    return upsertMember(db, { name, furigana });
  }

  async function upsertAndSetStatus(
    name: string,
    furigana: string,
    status: "ACTIVE" | "ON_LEAVE" | "WITHDRAWN",
  ) {
    const m = await upsertMemberHelper(name, furigana);
    if (status !== "ACTIVE") {
      await updateMemberStatus(db, m.id, status);
    }
    return m;
  }
});

// ---------------------------------------------------------------------------
// 5.4 月謝額の決定順位
// ---------------------------------------------------------------------------
describe("月謝額の決定順位", () => {
  test("DB-019: overrideが無ければbase_fee_settingを返す", async () => {
    await setBaseFee(db, 5000);
    expect(await getFeeForMonth(db, "2026-04")).toBe(5000);
  });

  test("DB-020: overrideがあればそちらが優先される", async () => {
    await setBaseFee(db, 5000);
    await setMonthFeeOverride(db, "2026-04", 6000);
    expect(await getFeeForMonth(db, "2026-04")).toBe(6000);
  });

  test("DB-021: overrideが0円でも優先される(override!==nullの境界値)", async () => {
    await setBaseFee(db, 5000);
    await setMonthFeeOverride(db, "2026-04", 0);
    expect(await getFeeForMonth(db, "2026-04")).toBe(0);
  });

  test("DB-022: getFeeForMonthsで複数月をまとめて取得できる", async () => {
    await setBaseFee(db, 5000);
    await setMonthFeeOverride(db, "2026-05", 7000);
    const result = await getFeeForMonths(db, ["2026-04", "2026-05", "2026-06"]);
    expect(result).toEqual({ "2026-04": 5000, "2026-05": 7000, "2026-06": 5000 });
  });

  test("DB-023: 空配列を渡すと空オブジェクトを返す", async () => {
    expect(await getFeeForMonths(db, [])).toEqual({});
  });

  test("DB-024: 同一月に2回設定すると2回目の値のみ有効", async () => {
    await setMonthFeeOverride(db, "2026-04", 6000);
    await setMonthFeeOverride(db, "2026-04", 6500);
    expect(await getMonthFeeOverride(db, "2026-04")).toBe(6500);
    const rows = await db.getAllAsync("SELECT * FROM month_fee_overrides WHERE month = '2026-04'");
    expect(rows).toHaveLength(1);
  });

  test("DB-025: clearMonthFeeOverride後はnull(基本額へフォールバック)", async () => {
    await setMonthFeeOverride(db, "2026-04", 6000);
    await clearMonthFeeOverride(db, "2026-04");
    expect(await getMonthFeeOverride(db, "2026-04")).toBeNull();
  });

  test("DB-026: 承認済み月へのsetMonthFeeOverride/clearMonthFeeOverrideはMonthLockedError", async () => {
    await setMonthFeeOverride(db, "2026-04", 6000);
    await approveMonth(db, "2026-04");

    await expect(setMonthFeeOverride(db, "2026-04", 7000)).rejects.toBeInstanceOf(MonthLockedError);
    await expect(clearMonthFeeOverride(db, "2026-04")).rejects.toBeInstanceOf(MonthLockedError);
    expect(await getMonthFeeOverride(db, "2026-04")).toBe(6000);
  });

  test("DB-027: setBaseFeeは初回INSERT・2回目UPDATEでレコードは1行のまま", async () => {
    await setBaseFee(db, 5000);
    await setBaseFee(db, 5500);
    const rows = await db.getAllAsync<{ amount: number }>("SELECT amount FROM base_fee_setting");
    expect(rows).toHaveLength(1);
    expect(rows[0].amount).toBe(5500);
    expect(await getBaseFee(db)).toBe(5500);
  });
});

// ---------------------------------------------------------------------------
// 5.5 月謝/ビジターの区分
// ---------------------------------------------------------------------------
describe("月謝/ビジターの区分", () => {
  test("DB-028: 未設定はMONTHLY(デフォルト)", async () => {
    const m = await upsertMember(db, { name: "山田太郎", furigana: "ヤマダタロウ" });
    expect(await getMemberMonthStatus(db, m.id, "2026-04")).toBe("MONTHLY");
  });

  test("DB-029/030: setMemberMonthStatusで設定した値が反映される", async () => {
    const m = await upsertMember(db, { name: "山田太郎", furigana: "ヤマダタロウ" });
    await setMemberMonthStatus(db, { memberId: m.id, month: "2026-04", type: "VISITOR" });
    expect(await getMemberMonthStatus(db, m.id, "2026-04")).toBe("VISITOR");
  });

  test("DB-031: 再設定はDELETE→INSERTで1レコードのみ残る", async () => {
    const m = await upsertMember(db, { name: "山田太郎", furigana: "ヤマダタロウ" });
    await setMemberMonthStatus(db, { memberId: m.id, month: "2026-04", type: "VISITOR" });
    await setMemberMonthStatus(db, { memberId: m.id, month: "2026-04", type: "MONTHLY" });

    const rows = await db.getAllAsync(
      "SELECT * FROM member_month_status WHERE member_id = ? AND month = ?",
      m.id,
      "2026-04",
    );
    expect(rows).toHaveLength(1);
    expect(await getMemberMonthStatus(db, m.id, "2026-04")).toBe("MONTHLY");
  });

  test("DB-032: 承認済み月へのsetMemberMonthStatusはMonthLockedError", async () => {
    const m = await upsertMember(db, { name: "山田太郎", furigana: "ヤマダタロウ" });
    await approveMonth(db, "2026-04");
    await expect(
      setMemberMonthStatus(db, { memberId: m.id, month: "2026-04", type: "VISITOR" }),
    ).rejects.toBeInstanceOf(MonthLockedError);
  });

  test("DB-033: listMemberMonthStatusForMonthはmemberIdごとのマップを返す", async () => {
    const a = await upsertMember(db, { name: "田中", furigana: "タナカ" });
    const b = await upsertMember(db, { name: "佐藤", furigana: "サトウ" });
    await setMemberMonthStatus(db, { memberId: a.id, month: "2026-04", type: "VISITOR" });

    const map = await listMemberMonthStatusForMonth(db, "2026-04");
    expect(map[a.id]).toBe("VISITOR");
    expect(map[b.id]).toBeUndefined();
  });

  test("DB-034: listMemberMonthStatusForMemberは月ごとのマップを返す", async () => {
    const m = await upsertMember(db, { name: "山田太郎", furigana: "ヤマダタロウ" });
    await setMemberMonthStatus(db, { memberId: m.id, month: "2026-04", type: "VISITOR" });
    await setMemberMonthStatus(db, { memberId: m.id, month: "2026-05", type: "MONTHLY" });

    const map = await listMemberMonthStatusForMember(db, m.id);
    expect(map).toEqual({ "2026-04": "VISITOR", "2026-05": "MONTHLY" });
  });
});

// ---------------------------------------------------------------------------
// 5.6 支払い登録・取消
// ---------------------------------------------------------------------------
describe("支払い登録・取消", () => {
  async function makeMember(name = "山田太郎", furigana = "ヤマダタロウ") {
    return upsertMember(db, { name, furigana });
  }

  test("DB-035: 日付ありで通常登録される", async () => {
    const m = await makeMember();
    await createPaymentForMember(db, { memberId: m.id, date: "2026-04-10", amount: 5000, type: "MONTHLY" });
    const payments = await listPaymentsForMember(db, m.id);
    expect(payments).toHaveLength(1);
    expect(payments[0].date).toBe("2026-04-10");
    expect(payments[0].amount).toBe(5000);
  });

  test("DB-036: 不足金支払い(date空)は登録できる", async () => {
    const m = await makeMember();
    await createPaymentForMember(db, { memberId: m.id, date: "", amount: 3000, type: "MONTHLY" });
    const payments = await listPaymentsForMember(db, m.id);
    expect(payments).toHaveLength(1);
    expect(payments[0].date).toBe("");
  });

  test("DB-037: 対象月(dateの月)が承認済みならMonthLockedError", async () => {
    const m = await makeMember();
    await approveMonth(db, "2026-04");
    await expect(
      createPaymentForMember(db, { memberId: m.id, date: "2026-04-10", amount: 5000, type: "MONTHLY" }),
    ).rejects.toBeInstanceOf(MonthLockedError);
    expect(await listPaymentsForMember(db, m.id)).toHaveLength(0);
  });

  test("DB-038: 不足金支払いで「今日の月」が承認済みならMonthLockedError", async () => {
    jest.useFakeTimers().setSystemTime(new Date("2026-04-15T03:00:00Z"));
    const m = await makeMember();
    await approveMonth(db, "2026-04");
    await expect(
      createPaymentForMember(db, { memberId: m.id, date: "", amount: 3000, type: "MONTHLY" }),
    ).rejects.toBeInstanceOf(MonthLockedError);
  });

  test("DB-039: note未指定は空文字で保存される", async () => {
    const m = await makeMember();
    await createPaymentForMember(db, { memberId: m.id, date: "2026-04-10", amount: 5000, type: "MONTHLY" });
    const payments = await listPaymentsForMember(db, m.id);
    expect(payments[0].note).toBe("");
  });

  test("DB-040: noteの前後空白がtrimされて保存される", async () => {
    const m = await makeMember();
    await createPaymentForMember(db, {
      memberId: m.id,
      date: "2026-04-10",
      amount: 5000,
      type: "MONTHLY",
      note: "  現金でお預かり  ",
    });
    const payments = await listPaymentsForMember(db, m.id);
    expect(payments[0].note).toBe("現金でお預かり");
  });

  test("DB-041: cancelPaymentは元レコードを残し、負数の新規レコードを追加する", async () => {
    const m = await makeMember();
    await createPaymentForMember(db, { memberId: m.id, date: "2026-04-10", amount: 5000, type: "MONTHLY" });
    const [original] = await listPaymentsForMember(db, m.id);

    await cancelPayment(db, original.id);

    const payments = await listPaymentsForMember(db, m.id);
    expect(payments).toHaveLength(2);
    const cancelRow = payments.find((p) => p.cancelsPaymentId === original.id);
    expect(cancelRow).toBeDefined();
    expect(cancelRow?.amount).toBe(-5000);
    expect(cancelRow?.date).toBe(original.date);
    expect(cancelRow?.type).toBe(original.type);
    const originalAfter = payments.find((p) => p.id === original.id);
    expect(originalAfter?.amount).toBe(5000);
  });

  test("DB-042: 存在しないIDを指定しても何もせず正常終了する", async () => {
    await expect(cancelPayment(db, "not-exist")).resolves.toBeUndefined();
  });

  test("DB-043: 取消レコード自体を取消しようとするとErrorがthrowされる", async () => {
    const m = await makeMember();
    await createPaymentForMember(db, { memberId: m.id, date: "2026-04-10", amount: 5000, type: "MONTHLY" });
    const [original] = await listPaymentsForMember(db, m.id);
    await cancelPayment(db, original.id);
    const cancelRow = (await listPaymentsForMember(db, m.id)).find((p) => p.cancelsPaymentId);

    await expect(cancelPayment(db, cancelRow!.id)).rejects.toThrow(
      "Cannot cancel a cancellation record.",
    );
  });

  test("DB-044: 既に取消済みの支払いを再度取消しようとするとErrorがthrowされる", async () => {
    const m = await makeMember();
    await createPaymentForMember(db, { memberId: m.id, date: "2026-04-10", amount: 5000, type: "MONTHLY" });
    const [original] = await listPaymentsForMember(db, m.id);
    await cancelPayment(db, original.id);

    await expect(cancelPayment(db, original.id)).rejects.toThrow(
      "This payment has already been cancelled.",
    );
  });

  test("DB-045: 不足金支払い(date空)の取消はcreatedAtの月で判定され成功する", async () => {
    jest.useFakeTimers().setSystemTime(new Date("2026-04-15T03:00:00Z"));
    const m = await makeMember();
    await createPaymentForMember(db, { memberId: m.id, date: "", amount: 3000, type: "MONTHLY" });
    const [original] = await listPaymentsForMember(db, m.id);
    await expect(cancelPayment(db, original.id)).resolves.toBeUndefined();
  });

  test("DB-046: 対象月が承認済みならcancelPaymentはMonthLockedErrorで、レコードは追加されない", async () => {
    const m = await makeMember();
    await createPaymentForMember(db, { memberId: m.id, date: "2026-04-10", amount: 5000, type: "MONTHLY" });
    const [original] = await listPaymentsForMember(db, m.id);
    await approveMonth(db, "2026-04");

    await expect(cancelPayment(db, original.id)).rejects.toBeInstanceOf(MonthLockedError);
    expect(await listPaymentsForMember(db, m.id)).toHaveLength(1);
  });

  test("DB-047: listPaymentsはdate DESC, created_at DESCで返る", async () => {
    const a = await makeMember("田中", "タナカ");
    const b = await makeMember("佐藤", "サトウ");
    await createPaymentForMember(db, { memberId: a.id, date: "2026-04-05", amount: 5000, type: "MONTHLY" });
    await createPaymentForMember(db, { memberId: b.id, date: "2026-04-10", amount: 5000, type: "MONTHLY" });

    const rows = await listPayments(db);
    expect(rows[0].date).toBe("2026-04-10");
    expect(rows[1].date).toBe("2026-04-05");
    expect(rows[0].memberName).toBe("佐藤");
  });

  test("DB-048: listPaymentsForMemberはそのメンバーのみ日付降順で返る", async () => {
    const a = await makeMember("田中", "タナカ");
    const b = await makeMember("佐藤", "サトウ");
    await createPaymentForMember(db, { memberId: a.id, date: "2026-04-05", amount: 5000, type: "MONTHLY" });
    await createPaymentForMember(db, { memberId: a.id, date: "2026-05-05", amount: 5000, type: "MONTHLY" });
    await createPaymentForMember(db, { memberId: b.id, date: "2026-04-10", amount: 5000, type: "MONTHLY" });

    const rows = await listPaymentsForMember(db, a.id);
    expect(rows.map((r) => r.date)).toEqual(["2026-05-05", "2026-04-05"]);
  });

  test("DB-049: listPaymentsForDateはメンバー名昇順で返る", async () => {
    const a = await makeMember("田中", "タナカ");
    const b = await makeMember("愛上", "アイウエ");
    await createPaymentForMember(db, { memberId: a.id, date: "2026-04-10", amount: 5000, type: "MONTHLY" });
    await createPaymentForMember(db, { memberId: b.id, date: "2026-04-10", amount: 5000, type: "MONTHLY" });

    const rows = await listPaymentsForDate(db, "2026-04-10");
    expect(rows.map((r) => r.memberName)).toEqual(["愛上", "田中"]);
  });
});

// ---------------------------------------------------------------------------
// 5.7 練習日・出欠
// ---------------------------------------------------------------------------
describe("練習日・出欠", () => {
  async function makeMember(name = "山田太郎", furigana = "ヤマダタロウ") {
    return upsertMember(db, { name, furigana });
  }

  test("DB-050: addPracticeDayで新規日付が登録される", async () => {
    await addPracticeDay(db, "2026-04-05");
    const days = await listPracticeDays(db);
    expect(days.map((d) => d.date)).toEqual(["2026-04-05"]);
  });

  test("DB-051: 既存日付の再追加はINSERT OR IGNOREで重複しない", async () => {
    await addPracticeDay(db, "2026-04-05");
    await expect(addPracticeDay(db, "2026-04-05")).resolves.not.toThrow();
    const days = await listPracticeDays(db);
    expect(days).toHaveLength(1);
  });

  test("DB-052: deletePracticeDayで削除される", async () => {
    await addPracticeDay(db, "2026-04-05");
    const [day] = await listPracticeDays(db);
    await deletePracticeDay(db, day.id);
    expect(await listPracticeDays(db)).toHaveLength(0);
  });

  test("DB-053: listPracticeDaysForMonthは対象月のみ日付昇順で返る", async () => {
    await addPracticeDay(db, "2026-04-20");
    await addPracticeDay(db, "2026-04-05");
    await addPracticeDay(db, "2026-05-01");

    const days = await listPracticeDaysForMonth(db, "2026-04");
    expect(days.map((d) => d.date)).toEqual(["2026-04-05", "2026-04-20"]);
  });

  test("DB-054: setAttendanceで新規出欠が登録される", async () => {
    const m = await makeMember();
    await setAttendance(db, { memberId: m.id, date: "2026-04-05" });
    expect(await listAttendanceForDate(db, "2026-04-05")).toHaveLength(1);
  });

  test("DB-055: 同一(date, member_id)への再実行は重複登録されない", async () => {
    const m = await makeMember();
    await setAttendance(db, { memberId: m.id, date: "2026-04-05" });
    await setAttendance(db, { memberId: m.id, date: "2026-04-05" });
    expect(await listAttendanceForDate(db, "2026-04-05")).toHaveLength(1);
  });

  test("DB-056: 対象日の月が承認済みならsetAttendanceはMonthLockedError", async () => {
    const m = await makeMember();
    await approveMonth(db, "2026-04");
    await expect(setAttendance(db, { memberId: m.id, date: "2026-04-05" })).rejects.toBeInstanceOf(
      MonthLockedError,
    );
  });

  test("DB-057: removeAttendanceで既存記録が削除される", async () => {
    const m = await makeMember();
    await setAttendance(db, { memberId: m.id, date: "2026-04-05" });
    await removeAttendance(db, { memberId: m.id, date: "2026-04-05" });
    expect(await listAttendanceForDate(db, "2026-04-05")).toHaveLength(0);
  });

  test("DB-058: 存在しない記録へのremoveAttendanceはエラーにならない", async () => {
    const m = await makeMember();
    await expect(removeAttendance(db, { memberId: m.id, date: "2026-04-05" })).resolves.toBeUndefined();
  });

  test("DB-059: 対象日の月が承認済みならremoveAttendanceはMonthLockedError", async () => {
    const m = await makeMember();
    await approveMonth(db, "2026-04");
    await expect(removeAttendance(db, { memberId: m.id, date: "2026-04-05" })).rejects.toBeInstanceOf(
      MonthLockedError,
    );
  });

  test("DB-060: VISITOR区分で出席・未払いは対象として返る", async () => {
    const m = await makeMember();
    await setMemberMonthStatus(db, { memberId: m.id, month: "2026-04", type: "VISITOR" });
    await setAttendance(db, { memberId: m.id, date: "2026-04-05" });

    const result = await listUnpaidVisitorAttendance(db);
    expect(result).toEqual([{ memberId: m.id, date: "2026-04-05" }]);
  });

  test("DB-061: VISITOR区分で該当日に支払い済みなら対象から除外される", async () => {
    const m = await makeMember();
    await setMemberMonthStatus(db, { memberId: m.id, month: "2026-04", type: "VISITOR" });
    await setAttendance(db, { memberId: m.id, date: "2026-04-05" });
    await createPaymentForMember(db, { memberId: m.id, date: "2026-04-05", amount: 1000, type: "VISITOR" });

    expect(await listUnpaidVisitorAttendance(db)).toEqual([]);
  });

  test("DB-062: MONTHLY区分(未設定含む)は対象から除外される", async () => {
    const m1 = await makeMember("田中", "タナカ");
    const m2 = await makeMember("佐藤", "サトウ");
    await setMemberMonthStatus(db, { memberId: m1.id, month: "2026-04", type: "MONTHLY" });
    await setAttendance(db, { memberId: m1.id, date: "2026-04-05" });
    // m2は member_month_status 未設定のままMONTHLY扱い
    await setAttendance(db, { memberId: m2.id, date: "2026-04-05" });

    expect(await listUnpaidVisitorAttendance(db)).toEqual([]);
  });

  test("DB-063: VISITOR区分・出席・支払いが取消済みなら再び未払い対象になる", async () => {
    const m = await makeMember();
    await setMemberMonthStatus(db, { memberId: m.id, month: "2026-04", type: "VISITOR" });
    await setAttendance(db, { memberId: m.id, date: "2026-04-05" });
    await createPaymentForMember(db, { memberId: m.id, date: "2026-04-05", amount: 1000, type: "VISITOR" });
    const [payment] = await listPaymentsForMember(db, m.id);
    await cancelPayment(db, payment.id);

    expect(await listUnpaidVisitorAttendance(db)).toEqual([{ memberId: m.id, date: "2026-04-05" }]);
  });

  test("DB-064: 取消レコード自体しか無い状態では正規の支払いとしてカウントされない", async () => {
    const m = await makeMember();
    await setMemberMonthStatus(db, { memberId: m.id, month: "2026-04", type: "VISITOR" });
    await setAttendance(db, { memberId: m.id, date: "2026-04-05" });
    await createPaymentForMember(db, { memberId: m.id, date: "2026-04-05", amount: 1000, type: "VISITOR" });
    const [payment] = await listPaymentsForMember(db, m.id);
    await cancelPayment(db, payment.id);
    // この時点で有効な支払いは無く、取消レコードのみが存在する。
    expect(await listUnpaidVisitorAttendance(db)).toEqual([{ memberId: m.id, date: "2026-04-05" }]);
  });
});

// ---------------------------------------------------------------------------
// 5.8 月の承認(ロック)
// ---------------------------------------------------------------------------
describe("月の承認(ロック)", () => {
  test("DB-065: 未承認の月はfalse", async () => {
    expect(await isMonthApproved(db, "2026-04")).toBe(false);
  });

  test("DB-066: month=空文字は早期returnでfalse", async () => {
    expect(await isMonthApproved(db, "")).toBe(false);
  });

  test("DB-067: approveMonth後はtrueになる", async () => {
    await approveMonth(db, "2026-04");
    expect(await isMonthApproved(db, "2026-04")).toBe(true);
  });

  test("DB-068: 同一月を2回承認してもエラーにならず1行のまま", async () => {
    await approveMonth(db, "2026-04");
    await expect(approveMonth(db, "2026-04")).resolves.toBeUndefined();
    const rows = await db.getAllAsync("SELECT * FROM month_approvals WHERE month = '2026-04'");
    expect(rows).toHaveLength(1);
  });

  test("DB-069: 承認解除関数は存在しない(承認は取り消し不可)", () => {
    expect((dbModule as unknown as Record<string, unknown>).unapproveMonth).toBeUndefined();
    expect((dbModule as unknown as Record<string, unknown>).revokeMonthApproval).toBeUndefined();
  });

  test("DB-070: 承認済み月への7関数すべてがMonthLockedErrorをthrowし、データは変更されない", async () => {
    const m = await upsertMember(db, { name: "山田太郎", furigana: "ヤマダタロウ" });
    await createPaymentForMember(db, { memberId: m.id, date: "2026-04-05", amount: 5000, type: "MONTHLY" });
    const [payment] = await listPaymentsForMember(db, m.id);
    await setAttendance(db, { memberId: m.id, date: "2026-04-05" });
    await approveMonth(db, "2026-04");

    await expect(setMonthFeeOverride(db, "2026-04", 6000)).rejects.toBeInstanceOf(MonthLockedError);
    await expect(clearMonthFeeOverride(db, "2026-04")).rejects.toBeInstanceOf(MonthLockedError);
    await expect(
      setMemberMonthStatus(db, { memberId: m.id, month: "2026-04", type: "VISITOR" }),
    ).rejects.toBeInstanceOf(MonthLockedError);
    await expect(
      createPaymentForMember(db, { memberId: m.id, date: "2026-04-06", amount: 5000, type: "MONTHLY" }),
    ).rejects.toBeInstanceOf(MonthLockedError);
    await expect(cancelPayment(db, payment.id)).rejects.toBeInstanceOf(MonthLockedError);
    await expect(setAttendance(db, { memberId: m.id, date: "2026-04-07" })).rejects.toBeInstanceOf(
      MonthLockedError,
    );
    await expect(removeAttendance(db, { memberId: m.id, date: "2026-04-05" })).rejects.toBeInstanceOf(
      MonthLockedError,
    );

    // データが変わっていないことの確認。
    expect(await getMonthFeeOverride(db, "2026-04")).toBeNull();
    expect(await getMemberMonthStatus(db, m.id, "2026-04")).toBe("MONTHLY");
    expect(await listPaymentsForMember(db, m.id)).toHaveLength(1);
    expect(await listAttendanceForDate(db, "2026-04-05")).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// 5.9 集計(listMonths)
// ---------------------------------------------------------------------------
describe("集計(listMonths)", () => {
  async function makeMember(name = "山田太郎", furigana = "ヤマダタロウ") {
    return upsertMember(db, { name, furigana });
  }

  test("DB-071: 練習日のみの月はpracticeDayCountのみカウントされる", async () => {
    await addPracticeDay(db, "2026-04-05");
    const months = await listMonths(db);
    const april = months.find((m) => m.month === "2026-04");
    expect(april?.practiceDayCount).toBe(1);
    expect(april?.totalCollected).toBe(0);
  });

  test("DB-072: 通常の支払いが複数件ある月はtotalCollectedが合算される", async () => {
    const a = await makeMember("田中", "タナカ");
    const b = await makeMember("佐藤", "サトウ");
    await createPaymentForMember(db, { memberId: a.id, date: "2026-04-05", amount: 5000, type: "MONTHLY" });
    await createPaymentForMember(db, { memberId: b.id, date: "2026-04-10", amount: 5000, type: "MONTHLY" });

    const months = await listMonths(db);
    const april = months.find((m) => m.month === "2026-04");
    expect(april?.totalCollected).toBe(10000);
  });

  test("DB-073: 取消ペアがある月はtotalCollectedは相殺され0になるが、paymentCountは2件カウントされる", async () => {
    const m = await makeMember();
    await createPaymentForMember(db, { memberId: m.id, date: "2026-04-05", amount: 5000, type: "MONTHLY" });
    const [payment] = await listPaymentsForMember(db, m.id);
    await cancelPayment(db, payment.id);

    const months = await listMonths(db);
    const april = months.find((m2) => m2.month === "2026-04");
    expect(april?.totalCollected).toBe(0);
    // 実装上の注意点: 取消済み元レコード・取消レコードの両方がカウントされ、
    // paymentCountは2件になる(listMonthsはexcludeCancelledPaymentsを適用していない)。
    expect(april?.paymentCount).toBe(2);
  });

  test("DB-074: 複数月が混在する場合はmonth降順でソートされる", async () => {
    await addPracticeDay(db, "2026-03-01");
    await addPracticeDay(db, "2026-05-01");
    await addPracticeDay(db, "2026-04-01");

    const months = await listMonths(db);
    expect(months.map((m) => m.month)).toEqual(["2026-05", "2026-04", "2026-03"]);
  });
});
