import React from "react";
import { Alert } from "react-native";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react-native";
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
  deleteMember,
  getMemberMonthStatus,
  isMonthApproved,
  setBaseFee,
  setMemberMonthStatus,
  upsertMember,
  type Member,
} from "@/lib/db";
import { currentMonthIso } from "@/lib/format";
import DashboardScreen from "@/app/(tabs)/index";

// expo-router and expo-sqlite are automatically replaced by the manual mocks
// in the root __mocks__/ directory (Jest does this for node_modules packages
// without an explicit jest.mock() call).

function mockAlert() {
  return jest.spyOn(Alert, "alert").mockImplementation(() => {});
}

type AlertButton = { text?: string; onPress?: () => void | Promise<void> };

// Alert.alert's confirm/cancel buttons are only reachable through the
// (mocked) call args -- find the button with the given label from the most
// recent matching Alert.alert call and invoke its onPress, wrapped in act()
// since it drives a React state update.
async function pressAlertButton(alertSpy: jest.SpyInstance, buttonText: string) {
  const call = [...alertSpy.mock.calls].reverse().find((c) =>
    (c[2] as AlertButton[] | undefined)?.some((b) => b.text === buttonText),
  );
  const button = (call?.[2] as AlertButton[] | undefined)?.find((b) => b.text === buttonText);
  if (!button?.onPress) throw new Error(`no "${buttonText}" button found in Alert calls`);
  await act(async () => {
    await button.onPress?.();
  });
}

async function waitForToggleChip(memberId: string) {
  await waitFor(() => expect(screen.getByTestId(`member-status-toggle-${memberId}`)).toBeTruthy());
}

let db: SQLiteDatabase;
let member: Member;
const month = currentMonthIso();

beforeEach(async () => {
  db = await createTestDb();
  __setTestDb(db);
  await setBaseFee(db, 5000);
  member = await upsertMember(db, { name: "山田太郎", furigana: "ヤマダタロウ" });
});

afterEach(() => {
  jest.restoreAllMocks();
});

test("CMP-011: 当月既に現在の区分での支払いがある場合、区分変更できない", async () => {
  await addPracticeDay(db, `${month}-01`);
  await createPaymentForMember(db, { memberId: member.id, date: `${month}-01`, amount: 5000, type: "MONTHLY", note: "" });
  const alertSpy = mockAlert();

  await render(<DashboardScreen />);
  await waitForToggleChip(member.id);
  await fireEvent.press(screen.getByTestId(`member-status-toggle-${member.id}`));

  expect(alertSpy).toHaveBeenCalledWith("区分を変更できません", expect.any(String));
  expect(await getMemberMonthStatus(db, member.id, month)).toBe("MONTHLY");
});

test("CMP-012: 区分未設定・支払いなしの場合、確認なしで即座に変更される", async () => {
  await addPracticeDay(db, `${month}-01`);
  const alertSpy = mockAlert();

  await render(<DashboardScreen />);
  await waitForToggleChip(member.id);
  await fireEvent.press(screen.getByTestId(`member-status-toggle-${member.id}`));

  expect(alertSpy).not.toHaveBeenCalled();
  await waitFor(async () => expect(await getMemberMonthStatus(db, member.id, month)).toBe("VISITOR"));
});

test("CMP-013: 区分設定済み・支払いなしの場合、確認ダイアログ後にのみ変更される", async () => {
  await addPracticeDay(db, `${month}-01`);
  await setMemberMonthStatus(db, { memberId: member.id, month, type: "MONTHLY" });
  const alertSpy = mockAlert();

  await render(<DashboardScreen />);
  await waitForToggleChip(member.id);
  await fireEvent.press(screen.getByTestId(`member-status-toggle-${member.id}`));

  expect(alertSpy).toHaveBeenCalledWith("区分を変更しますか？", expect.any(String), expect.any(Array));
  // ダイアログを表示しただけでは変更されていない。
  expect(await getMemberMonthStatus(db, member.id, month)).toBe("MONTHLY");

  await pressAlertButton(alertSpy, "変更する");
  await waitFor(async () => expect(await getMemberMonthStatus(db, member.id, month)).toBe("VISITOR"));
});

test("CMP-014: MonthLockedErrorはAlertで捕捉され、状態が再読込される", async () => {
  await addPracticeDay(db, `${month}-01`);
  const alertSpy = mockAlert();

  await render(<DashboardScreen />);
  await waitForToggleChip(member.id);
  // 画面を開いたまま(別画面での操作を想定して)月を承認する。画面自身の
  // approvedステートは明示的な再読込までは追従しないため、まだfalseのまま。
  await approveMonth(db, month);

  await fireEvent.press(screen.getByTestId(`member-status-toggle-${member.id}`));

  await waitFor(() => expect(alertSpy).toHaveBeenCalledWith("変更できません", expect.any(String)));
  await waitFor(() => expect(screen.getByTestId("month-approved-badge")).toBeTruthy());
});

test("CMP-015: 全員支払い済みなら承認ボタンが表示される", async () => {
  await addPracticeDay(db, `${month}-01`);
  await createPaymentForMember(db, { memberId: member.id, date: `${month}-01`, amount: 5000, type: "MONTHLY", note: "" });

  await render(<DashboardScreen />);

  await waitFor(() => expect(screen.getByTestId("approve-month-button")).toBeTruthy());
});

test("CMP-016: 未払いのメンバーがいる場合は承認ボタンが表示されない", async () => {
  await addPracticeDay(db, `${month}-01`);

  await render(<DashboardScreen />);
  await waitForToggleChip(member.id);

  expect(screen.queryByTestId("approve-month-button")).toBeNull();
});

test("CMP-017a: メンバーが0名の場合、承認ボタンは表示されない", async () => {
  await deleteMember(db, member.id);
  await addPracticeDay(db, `${month}-01`);

  await render(<DashboardScreen />);

  await waitFor(() => expect(screen.getByText("まだメンバーが登録されていません。「入力」タブから記録してください。")).toBeTruthy());
  expect(screen.queryByTestId("approve-month-button")).toBeNull();
});

test("CMP-017b: 当月の練習日が0件の場合、承認ボタンは表示されない", async () => {
  await render(<DashboardScreen />);

  await waitFor(() =>
    expect(screen.getByText("この月の練習日が登録されていません。「設定」タブで登録してください。")).toBeTruthy(),
  );
  expect(screen.queryByTestId("approve-month-button")).toBeNull();
});

test("CMP-018: 承認確認ダイアログで「承認する」を選択すると承認される", async () => {
  await addPracticeDay(db, `${month}-01`);
  await createPaymentForMember(db, { memberId: member.id, date: `${month}-01`, amount: 5000, type: "MONTHLY", note: "" });
  const alertSpy = mockAlert();

  await render(<DashboardScreen />);
  await waitFor(() => expect(screen.getByTestId("approve-month-button")).toBeTruthy());
  await fireEvent.press(screen.getByTestId("approve-month-button"));

  expect(alertSpy).toHaveBeenCalledWith("この月を承認しますか？", expect.any(String), expect.any(Array));
  expect(await isMonthApproved(db, month)).toBe(false);

  await pressAlertButton(alertSpy, "承認する");

  await waitFor(() => expect(screen.getByTestId("month-approved-badge")).toBeTruthy());
  expect(await isMonthApproved(db, month)).toBe(true);
});

test("CMP-019: 承認済みの月では月謝変更ボタンと区分チップが無効になる", async () => {
  await addPracticeDay(db, `${month}-01`);
  await approveMonth(db, month);

  await render(<DashboardScreen />);
  await waitFor(() => expect(screen.getByTestId("month-approved-badge")).toBeTruthy());

  expect(screen.getByTestId("change-fee-button").props.accessibilityState?.disabled).toBe(true);
  expect(
    screen.getByTestId(`member-status-toggle-${member.id}`).props.accessibilityState?.disabled,
  ).toBe(true);
});
