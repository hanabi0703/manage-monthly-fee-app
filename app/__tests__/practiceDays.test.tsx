import React from "react";
import { Alert } from "react-native";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react-native";
import type { SQLiteDatabase } from "expo-sqlite";
import { __setTestDb } from "@/__mocks__/expo-sqlite";
import { createTestDb } from "@/lib/__tests__/testDb";
import {
  addPracticeDay,
  cancelPayment,
  createPaymentForMember,
  listAttendanceForDate,
  listPracticeDaysForMonth,
  setAttendance,
  upsertMember,
  type Member,
} from "@/lib/db";
import { currentMonthIso } from "@/lib/format";
import PracticeDaysScreen from "@/app/practice-days";

// expo-router and expo-sqlite are automatically replaced by the manual mocks
// in the root __mocks__/ directory (Jest does this for node_modules packages
// without an explicit jest.mock() call).

// DateField wraps a native community date picker that isn't practical to
// drive through this jest environment (no inline testID, no rendered
// interactive surface). We only need to test practice-days.tsx's own logic
// (handleAdd's length guard), so it's replaced with a plain controllable
// TextInput exposing the same testID/value/onChange contract.
jest.mock("@/components/DateField", () => {
  const { createElement } = require("react");
  const { TextInput: RNTextInput } = require("react-native");
  return {
    DateField: ({ testID, value, onChange }: { testID?: string; value: string; onChange: (v: string) => void }) =>
      createElement(RNTextInput, { testID, value, onChangeText: onChange }),
  };
});

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
  member = await upsertMember(db, { name: "山田太郎", furigana: "ヤマダタロウ" });
});

afterEach(() => {
  jest.restoreAllMocks();
});

test("CMP-040: 取消されていない支払い記録がある日は削除できない", async () => {
  const date = `${month}-01`;
  await addPracticeDay(db, date);
  await createPaymentForMember(db, { memberId: member.id, date, amount: 5000, type: "MONTHLY", note: "" });
  const alertSpy = mockAlert();

  await render(<PracticeDaysScreen />);
  await waitFor(() => expect(screen.getByText("削除")).toBeTruthy());
  await fireEvent.press(screen.getByText("削除"));

  await waitFor(() => expect(alertSpy).toHaveBeenCalledWith("削除できません", expect.any(String)));
  expect(await listPracticeDaysForMonth(db, month)).toHaveLength(1);
});

test("CMP-041: 支払いがすべて取消済みの場合は削除禁止の対象にならない", async () => {
  const date = `${month}-01`;
  await addPracticeDay(db, date);
  const payments = await createPaymentAndGet(date, 5000);
  await cancelPayment(db, payments.id);
  const alertSpy = mockAlert();

  await render(<PracticeDaysScreen />);
  await waitFor(() => expect(screen.getByText("削除")).toBeTruthy());
  await fireEvent.press(screen.getByText("削除"));

  // 支払いは(取消済みとして)ブロック対象に含まれず、出欠記録も無いため
  // 確認なしで即座に削除される。
  expect(alertSpy).not.toHaveBeenCalledWith("削除できません", expect.any(String));
  await waitFor(async () => expect(await listPracticeDaysForMonth(db, month)).toHaveLength(0));
});

test("CMP-042: 出欠記録のみある場合は確認ダイアログ後に出欠削除+練習日削除が実行される", async () => {
  const date = `${month}-01`;
  await addPracticeDay(db, date);
  await setAttendance(db, { memberId: member.id, date });
  const alertSpy = mockAlert();

  await render(<PracticeDaysScreen />);
  await waitFor(() => expect(screen.getByText("削除")).toBeTruthy());
  await fireEvent.press(screen.getByText("削除"));

  expect(alertSpy).toHaveBeenCalledWith("練習日を削除しますか？", expect.any(String), expect.any(Array));
  expect(await listPracticeDaysForMonth(db, month)).toHaveLength(1);

  await pressAlertButton(alertSpy, "削除する");

  await waitFor(async () => expect(await listPracticeDaysForMonth(db, month)).toHaveLength(0));
  expect(await listAttendanceForDate(db, date)).toHaveLength(0);
});

test("CMP-043: 支払い・出欠どちらの記録もない場合は確認なしで即座に削除される", async () => {
  const date = `${month}-01`;
  await addPracticeDay(db, date);
  const alertSpy = mockAlert();

  await render(<PracticeDaysScreen />);
  await waitFor(() => expect(screen.getByText("削除")).toBeTruthy());
  await fireEvent.press(screen.getByText("削除"));

  expect(alertSpy).not.toHaveBeenCalled();
  await waitFor(async () => expect(await listPracticeDaysForMonth(db, month)).toHaveLength(0));
});

test("CMP-044: 日付が10文字(YYYY-MM-DD)でない不正値の場合、addPracticeDayは呼ばれない", async () => {
  await render(<PracticeDaysScreen />);
  await waitFor(() => expect(screen.getByTestId("practice-day-date")).toBeTruthy());

  await fireEvent.changeText(screen.getByTestId("practice-day-date"), "2026-1"); // 6文字、不正値
  await fireEvent.press(screen.getByTestId("practice-day-submit"));

  await waitFor(async () => expect(await listPracticeDaysForMonth(db, month)).toHaveLength(0));
});

async function createPaymentAndGet(date: string, amount: number) {
  await createPaymentForMember(db, { memberId: member.id, date, amount, type: "MONTHLY", note: "" });
  const rows = await db.getFirstAsync<{ id: string }>(
    "SELECT id FROM payments WHERE member_id = ? AND date = ? AND amount = ?",
    member.id,
    date,
    amount,
  );
  if (!rows) throw new Error("payment not found after creation");
  return rows;
}
