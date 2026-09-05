import React from "react";
import { Alert } from "react-native";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react-native";
import type { SQLiteDatabase } from "expo-sqlite";
// Imported from the mock file directly (rather than "expo-sqlite") so that
// tsc can see this export -- Jest still resolves the app code's own
// `import { useSQLiteContext } from "expo-sqlite"` to this same mock file
// automatically, since it's a manual mock for a node_modules package.
import { __setTestDb } from "@/__mocks__/expo-sqlite";
import { createTestDb } from "@/lib/__tests__/testDb";
import {
  addPracticeDay,
  approveMonth,
  createPaymentForMember,
  deletePracticeDay,
  listPaymentsForMember,
  setAttendance,
  setBaseFee,
  setMemberMonthStatus,
  upsertMember,
  type Member,
} from "@/lib/db";
import { currentMonthIso, shiftMonth } from "@/lib/format";
import EntryScreen from "@/app/(tabs)/entry";

// expo-router and expo-sqlite are automatically replaced by the manual mocks
// in the root __mocks__/ directory (Jest does this for node_modules packages
// without an explicit jest.mock() call).

function mockAlert() {
  return jest.spyOn(Alert, "alert").mockImplementation(() => {});
}

// fireEvent (RNTL v14) is itself async and must be awaited, just like
// render() -- otherwise the state update it triggers hasn't flushed yet
// by the time the next assertion/query runs.
async function selectMember(memberId: string) {
  await waitFor(() => expect(screen.getByTestId("entry-member-select")).toBeTruthy());
  await fireEvent.press(screen.getByTestId("entry-member-select"));
  await fireEvent.press(screen.getByTestId(`entry-member-select-option-${memberId}`));
}

async function openDateDropdown() {
  await waitFor(() => expect(screen.getByTestId("entry-date")).toBeTruthy());
  await fireEvent.press(screen.getByTestId("entry-date"));
}

async function waitForSubmitEnabled() {
  await waitFor(() =>
    expect(screen.getByTestId("entry-submit").props.accessibilityState?.disabled).toBe(false),
  );
}

let db: SQLiteDatabase;
let member: Member;

beforeEach(async () => {
  db = await createTestDb();
  __setTestDb(db);
  await setBaseFee(db, 5000);
  member = await upsertMember(db, { name: "山田太郎", furigana: "ヤマダタロウ" });
});

afterEach(() => {
  jest.restoreAllMocks();
});

test("CMP-001: 選択中の日付に既に支払いがある場合はアラートを出し、二重登録しない", async () => {
  const date = `${currentMonthIso()}-01`;
  await addPracticeDay(db, date);
  const alertSpy = mockAlert();

  await render(<EntryScreen />);
  await selectMember(member.id);
  // 日付は候補が1件しかないため自動選択される。ここで(画面が知らないうちに)
  // 別経路から同じ日付の支払いが記録された状態を再現する
  // (二重タップなどで submit 実行前に競合登録が挟まるケース)。
  await waitForSubmitEnabled();
  await createPaymentForMember(db, { memberId: member.id, date, amount: 5000, type: "MONTHLY", note: "" });

  await fireEvent.press(screen.getByTestId("entry-submit"));

  await waitFor(() => expect(alertSpy).toHaveBeenCalledWith("支払い済みです", expect.any(String)));
  expect(await listPaymentsForMember(db, member.id)).toHaveLength(1);
});

test("CMP-002: 区分の状態と現在のDB上の区分が食い違う場合はアラートを出し中断する", async () => {
  const month = currentMonthIso();
  const date = `${month}-02`;
  await addPracticeDay(db, date);
  await setMemberMonthStatus(db, { memberId: member.id, month, type: "VISITOR" });
  await setAttendance(db, { memberId: member.id, date });

  const alertSpy = mockAlert();
  await render(<EntryScreen />);
  await selectMember(member.id);

  // 画面がVISITORとして区分を読み込んだ後、(会計表など別画面での操作を想定して)
  // DB上の区分をMONTHLYに戻す。entry画面はmemberId/dateが変わらない限り
  // 区分を再取得しないため、画面のtypeステートはVISITORのまま食い違う。
  await waitForSubmitEnabled();
  await setMemberMonthStatus(db, { memberId: member.id, month, type: "MONTHLY" });

  await fireEvent.press(screen.getByTestId("entry-submit"));

  await waitFor(() => expect(alertSpy).toHaveBeenCalledWith("区分が一致しません", expect.any(String)));
  expect(await listPaymentsForMember(db, member.id)).toHaveLength(0);
});

test("CMP-003: 正常系では正しい引数で登録され、フォームがリセットされる", async () => {
  const date = `${currentMonthIso()}-03`;
  await addPracticeDay(db, date);

  await render(<EntryScreen />);
  await selectMember(member.id);
  await waitForSubmitEnabled();
  await fireEvent.changeText(screen.getByTestId("entry-note"), "現金");

  await fireEvent.press(screen.getByTestId("entry-submit"));

  await waitFor(() => expect(screen.getByTestId("entry-feedback")).toBeTruthy());
  const payments = await listPaymentsForMember(db, member.id);
  expect(payments).toHaveLength(1);
  expect(payments[0]).toMatchObject({ date, amount: 5000, type: "MONTHLY", note: "現金" });

  expect(screen.getByTestId("entry-note").props.value).toBe("");
});

test("CMP-004: MonthLockedErrorはアラートで捕捉され、クラッシュせず登録されない", async () => {
  const month = currentMonthIso();
  const date = `${month}-04`;
  await addPracticeDay(db, date);
  await approveMonth(db, month);

  const alertSpy = mockAlert();
  await render(<EntryScreen />);
  await selectMember(member.id);
  await waitForSubmitEnabled();

  await fireEvent.press(screen.getByTestId("entry-submit"));

  await waitFor(() => expect(alertSpy).toHaveBeenCalledWith("登録できません", expect.any(String)));
  expect(await listPaymentsForMember(db, member.id)).toHaveLength(0);
});

test("CMP-005: 当月未払い(0円)かつ繰越未払いがある場合、繰越未払金+当月月謝額が初期値になる", async () => {
  const month = currentMonthIso();
  const lastMonth = shiftMonth(month, -1);
  // 前月に一部だけ支払い済み(5000円のうち2000円)で繰越未払い3000円がある状態。
  await createPaymentForMember(db, {
    memberId: member.id,
    date: `${lastMonth}-10`,
    amount: 2000,
    type: "MONTHLY",
    note: "",
  });

  await render(<EntryScreen />);
  await selectMember(member.id);
  await waitFor(() => expect(screen.getByTestId("entry-type-shortfall")).toBeTruthy());
  await fireEvent.press(screen.getByTestId("entry-type-shortfall"));

  await waitFor(() => expect(screen.getByTestId("entry-amount").props.value).toBe("8000"));
});

test("CMP-006: 当月一部支払い済みの場合、当月月謝額は二重に差し引かれない", async () => {
  const month = currentMonthIso();
  await createPaymentForMember(db, {
    memberId: member.id,
    date: `${month}-05`,
    amount: 2000,
    type: "MONTHLY",
    note: "",
  });

  await render(<EntryScreen />);
  await selectMember(member.id);
  await waitFor(() => expect(screen.getByTestId("entry-type-shortfall")).toBeTruthy());
  await fireEvent.press(screen.getByTestId("entry-type-shortfall"));

  // 二重に差し引かれるバグがあれば 8000 になってしまうところ、3000 が正しい。
  await waitFor(() => expect(screen.getByTestId("entry-amount").props.value).toBe("3000"));
});

test("CMP-007: 相殺後がプラス(繰越超過)の場合、金額は0未満にならない", async () => {
  const month = currentMonthIso();
  await createPaymentForMember(db, {
    memberId: member.id,
    date: `${month}-06`,
    amount: 6000,
    type: "MONTHLY",
    note: "",
  });

  await render(<EntryScreen />);
  await selectMember(member.id);
  await waitFor(() => expect(screen.getByTestId("entry-type-shortfall")).toBeTruthy());
  await fireEvent.press(screen.getByTestId("entry-type-shortfall"));

  await waitFor(() => expect(screen.getByTestId("entry-amount").props.value).toBe("0"));
});

test("CMP-008: 未払い月謝月・未払いビジター出席日以外(支払済み)は日付候補から除外される", async () => {
  const month = currentMonthIso();
  const paidMonth = shiftMonth(month, -1);
  const visitorMonth = shiftMonth(month, 1);
  const paidDate = `${paidMonth}-01`;
  const unpaidMonthlyDate = `${month}-01`;
  const unpaidVisitorDate = `${visitorMonth}-08`;

  await addPracticeDay(db, paidDate);
  await addPracticeDay(db, unpaidMonthlyDate);
  await addPracticeDay(db, unpaidVisitorDate);
  await createPaymentForMember(db, { memberId: member.id, date: paidDate, amount: 5000, type: "MONTHLY", note: "" });
  await setMemberMonthStatus(db, { memberId: member.id, month: visitorMonth, type: "VISITOR" });
  await setAttendance(db, { memberId: member.id, date: unpaidVisitorDate });

  await render(<EntryScreen />);
  await selectMember(member.id);
  await openDateDropdown();

  expect(screen.getByTestId(`entry-date-option-${unpaidMonthlyDate}`)).toBeTruthy();
  expect(screen.getByTestId(`entry-date-option-${unpaidVisitorDate}`)).toBeTruthy();
  expect(screen.queryByTestId(`entry-date-option-${paidDate}`)).toBeNull();
});

test("CMP-009: 練習日設定から削除済みでも、ビジター代未払いの出席日は候補に残る", async () => {
  const month = currentMonthIso();
  const date = `${month}-09`;
  await addPracticeDay(db, date);
  const day = await db.getFirstAsync<{ id: string }>(
    "SELECT id FROM practice_days WHERE date = ?",
    date,
  );
  await setMemberMonthStatus(db, { memberId: member.id, month, type: "VISITOR" });
  await setAttendance(db, { memberId: member.id, date });
  // 練習日設定からは削除されているが、ビジター代はまだ未払いのまま。
  if (day) await deletePracticeDay(db, day.id);

  await render(<EntryScreen />);
  await selectMember(member.id);
  await openDateDropdown();

  expect(screen.getByTestId(`entry-date-option-${date}`)).toBeTruthy();
});

test("CMP-010a: メンバー未選択の場合、送信ボタンが無効になる", async () => {
  await render(<EntryScreen />);
  await waitFor(() => expect(screen.getByTestId("entry-submit").props.accessibilityState?.disabled).toBe(true));
});

test("CMP-010b: 不足金モードで金額を空にすると、送信ボタンが無効になる", async () => {
  await render(<EntryScreen />);
  await selectMember(member.id);
  await waitFor(() => expect(screen.getByTestId("entry-type-shortfall")).toBeTruthy());
  await fireEvent.press(screen.getByTestId("entry-type-shortfall"));
  await waitFor(() => expect(screen.getByTestId("entry-amount").props.value).not.toBe(""));

  await fireEvent.changeText(screen.getByTestId("entry-amount"), "");

  expect(screen.getByTestId("entry-submit").props.accessibilityState?.disabled).toBe(true);
});

test("CMP-010c: 不足金モードでなく日付候補が無いメンバーの場合、送信ボタンが無効になる", async () => {
  const month = currentMonthIso();
  const date = `${month}-01`;
  await addPracticeDay(db, date);
  const memberB = await upsertMember(db, { name: "佐藤花子", furigana: "サトウハナコ" });
  // memberBはこの日を含む月がVISITOR区分だが出席記録が無いため、
  // 未払い候補としては一件もヒットしない(=日付候補が空になる)。
  await setMemberMonthStatus(db, { memberId: memberB.id, month, type: "VISITOR" });

  await render(<EntryScreen />);
  // メンバー未選択の初期表示時点で、グローバルな練習日一覧から日付と金額
  // (当月月謝額5,000円)が既に自動設定されている。
  await waitFor(() =>
    expect(within(screen.getByTestId("entry-amount")).getByText("¥5,000")).toBeTruthy(),
  );

  await selectMember(memberB.id);

  // このメンバーには未払いの日付候補が無いため、日付フィールド自体が消える
  // (=日付は事実上未選択)一方、金額は直前の表示のまま残る。
  await waitFor(() => expect(screen.queryByTestId("entry-date")).toBeNull());
  expect(within(screen.getByTestId("entry-amount")).getByText("¥5,000")).toBeTruthy();
  expect(screen.getByTestId("entry-submit").props.accessibilityState?.disabled).toBe(true);
});
