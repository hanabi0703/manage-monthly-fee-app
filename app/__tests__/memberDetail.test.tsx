import React from "react";
import { Alert } from "react-native";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react-native";
import type { SQLiteDatabase } from "expo-sqlite";
import { __setTestDb } from "@/__mocks__/expo-sqlite";
import { __setParams } from "@/__mocks__/expo-router";
import { createTestDb } from "@/lib/__tests__/testDb";
import {
  approveMonth,
  cancelPayment,
  createPaymentForMember,
  listPaymentsForMember,
  setBaseFee,
  upsertMember,
  type Member,
} from "@/lib/db";
import { currentMonthIso, shiftMonth } from "@/lib/format";
import MemberDetailScreen from "@/app/members/[id]/index";

// expo-router and expo-sqlite are automatically replaced by the manual mocks
// in the root __mocks__/ directory (Jest does this for node_modules packages
// without an explicit jest.mock() call).

function mockAlert() {
  return jest.spyOn(Alert, "alert").mockImplementation(() => {});
}

type AlertButton = { text?: string; onPress?: () => void | Promise<void> };

async function pressAlertButton(alertSpy: jest.SpyInstance, buttonText: string) {
  const call = [...alertSpy.mock.calls].reverse().find((c) =>
    (c[2] as AlertButton[] | undefined)?.some((b) => b.text === buttonText),
  );
  const button = (call?.[2] as AlertButton[] | undefined)?.find((b) => b.text === buttonText);
  if (!button?.onPress) throw new Error(`no "${buttonText}" button found in Alert calls`);
  return act(async () => button.onPress?.());
}

let db: SQLiteDatabase;
let member: Member;
const month = currentMonthIso();

beforeEach(async () => {
  db = await createTestDb();
  __setTestDb(db);
  await setBaseFee(db, 5000);
  member = await upsertMember(db, { name: "山田太郎", furigana: "ヤマダタロウ" });
  __setParams({ id: member.id });
});

afterEach(() => {
  jest.restoreAllMocks();
  __setParams({});
});

test("CMP-027: 月謝不足またはビジター未払いがあると「未払い」表示になる", async () => {
  const lastMonth = shiftMonth(month, -1);
  // 繰越未払い3000円(前月2000円/5000円払い済み)+当月未払い5000円=8000円。
  await createPaymentForMember(db, { memberId: member.id, date: `${lastMonth}-10`, amount: 2000, type: "MONTHLY", note: "" });

  await render(<MemberDetailScreen />);

  await waitFor(() => expect(screen.getByText("未払い")).toBeTruthy());
  expect(screen.getAllByText("¥8,000").length).toBeGreaterThan(0);
});

test("CMP-028: 繰越金がある(未払いなし)場合は「繰越金」表示になる", async () => {
  await createPaymentForMember(db, { memberId: member.id, date: `${month}-01`, amount: 8000, type: "MONTHLY", note: "" });

  await render(<MemberDetailScreen />);

  await waitFor(() => expect(screen.getByText("繰越金")).toBeTruthy());
  expect(screen.getByText("¥3,000")).toBeTruthy();
});

test("CMP-029: 過不足なし(未払いなし)の場合は「精算済み」表示になる", async () => {
  await createPaymentForMember(db, { memberId: member.id, date: `${month}-01`, amount: 5000, type: "MONTHLY", note: "" });

  await render(<MemberDetailScreen />);

  await waitFor(() => expect(screen.getByText("なし（精算済み）")).toBeTruthy());
});

test("CMP-030: 当月未払い加算(メンバー詳細側)はメンバー一覧側(CMP-022)と同じ結果になる", async () => {
  const lastMonth = shiftMonth(month, -1);
  await createPaymentForMember(db, { memberId: member.id, date: `${lastMonth}-10`, amount: 2000, type: "MONTHLY", note: "" });

  await render(<MemberDetailScreen />);

  // CMP-022と同一の入力(繰越未払い3000円+当月未払い5000円)に対して、
  // メンバー一覧側と同じ8000円が算出されること(重複実装の乖離検知)。
  await waitFor(() => expect(screen.getAllByText("¥8,000").length).toBeGreaterThan(0));
});

test("CMP-031: 通常の取消ではcancelPaymentが呼ばれ、一覧が再読込される", async () => {
  const payment = await createPaymentForMemberAndGet(`${month}-01`, 5000);
  const alertSpy = mockAlert();

  await render(<MemberDetailScreen />);
  await waitFor(() => expect(screen.getByTestId(`payment-cancel-${payment.id}`)).toBeTruthy());
  await fireEvent.press(screen.getByTestId(`payment-cancel-${payment.id}`));
  await pressAlertButton(alertSpy, "取消する");

  await waitFor(async () => {
    const payments = await listPaymentsForMember(db, member.id);
    expect(payments).toHaveLength(2);
    expect(payments.some((p) => p.cancelsPaymentId === payment.id)).toBe(true);
  });
  // 再読込後は「取消済み」バッジが表示され、取消ボタンは消える。
  await waitFor(() => expect(screen.getByText("取消済み")).toBeTruthy());
  expect(screen.queryByTestId(`payment-cancel-${payment.id}`)).toBeNull();
});

test("CMP-032: MonthLockedErrorの場合は「取消できません」アラートが表示される", async () => {
  const payment = await createPaymentForMemberAndGet(`${month}-01`, 5000);
  const alertSpy = mockAlert();

  await render(<MemberDetailScreen />);
  await waitFor(() => expect(screen.getByTestId(`payment-cancel-${payment.id}`)).toBeTruthy());
  // 画面を開いたまま(別画面での操作を想定して)月を承認する。
  await approveMonth(db, month);

  await fireEvent.press(screen.getByTestId(`payment-cancel-${payment.id}`));
  await pressAlertButton(alertSpy, "取消する");

  await waitFor(() => expect(alertSpy).toHaveBeenCalledWith("取消できません", expect.any(String)));
  expect(await listPaymentsForMember(db, member.id)).toHaveLength(1);
});

test("CMP-033: cancelPaymentの素のErrorはinstanceof MonthLockedErrorに該当せず再スローされる", async () => {
  const payment = await createPaymentForMemberAndGet(`${month}-01`, 5000);
  const alertSpy = mockAlert();

  await render(<MemberDetailScreen />);
  await waitFor(() => expect(screen.getByTestId(`payment-cancel-${payment.id}`)).toBeTruthy());
  // 取消の確認ダイアログを開き、「取消する」ボタンのonPress(=handleCancel(payment.id)の
  // クロージャ)を捕捉する。実行前に、別経路で先にこの支払いを取消しておく
  // (UI上は取消後は取消ボタン自体が消えるため、二重取消は通常操作では
  // 到達できない状態だが、それでもhandleCancelの例外処理を検証する)。
  await fireEvent.press(screen.getByTestId(`payment-cancel-${payment.id}`));
  const call = [...alertSpy.mock.calls].reverse().find((c) =>
    (c[2] as AlertButton[] | undefined)?.some((b) => b.text === "取消する"),
  );
  const confirmButton = (call?.[2] as AlertButton[] | undefined)?.find((b) => b.text === "取消する");
  expect(confirmButton?.onPress).toBeTruthy();

  await cancelPayment(db, payment.id); // 正規のルートで先に取消しておく

  // instanceof MonthLockedErrorのガードに該当しないため、
  // 「This payment has already been cancelled.」がそのまま再スローされる。
  // handleCancelはこれを一切捕捉しないので、呼び出し元(AlertのonPress)が
  // 未処理の例外/rejectionを受け取ることになる(改善要否の申し送り事項)。
  await expect(act(async () => confirmButton?.onPress?.())).rejects.toThrow(
    "This payment has already been cancelled.",
  );
  // MonthLockedError用の「取消できません」アラートは表示されない
  // (この経路はその分岐を通らないため)。
  expect(alertSpy).not.toHaveBeenCalledWith("取消できません", expect.any(String));
});

async function createPaymentForMemberAndGet(date: string, amount: number) {
  await createPaymentForMember(db, { memberId: member.id, date, amount, type: "MONTHLY", note: "" });
  const payments = await listPaymentsForMember(db, member.id);
  const payment = payments.find((p) => p.date === date && p.amount === amount);
  if (!payment) throw new Error("payment not found after creation");
  return payment;
}
