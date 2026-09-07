import { Alert } from "react-native";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react-native";
import type { SQLiteDatabase } from "expo-sqlite";
import { __setTestDb } from "@/__mocks__/expo-sqlite";
import { __setParams } from "@/__mocks__/expo-router";
import { createTestDb } from "@/lib/__tests__/testDb";
import { approveMonth, getBaseFee, getMonthFeeOverride, setBaseFee } from "@/lib/db";
import { currentMonthIso } from "@/lib/format";
import BaseFeeSettingsScreen from "@/app/base-fee-settings";
import MonthFeeSettingScreen from "@/app/fee-history/[month]";

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
const month = currentMonthIso();

beforeEach(async () => {
  db = await createTestDb();
  __setTestDb(db);
  await setBaseFee(db, 5000);
});

afterEach(() => {
  jest.restoreAllMocks();
  __setParams({});
});

test("CMP-045: base-fee-settingsの金額入力は数字以外を除去する", async () => {
  await render(<BaseFeeSettingsScreen />);
  await waitFor(() => expect(screen.getByTestId("base-fee-amount").props.value).toBe("5000"));

  await fireEvent.changeText(screen.getByTestId("base-fee-amount"), "12a3b");

  expect(screen.getByTestId("base-fee-amount").props.value).toBe("123");
});

test("CMP-046: base-fee-settingsは入力が空、または現在値と同一なら保存ボタンが無効になる", async () => {
  await render(<BaseFeeSettingsScreen />);
  await waitFor(() => expect(screen.getByTestId("base-fee-amount").props.value).toBe("5000"));

  // 現在値と同一。
  expect(screen.getByTestId("base-fee-save").props.accessibilityState?.disabled).toBe(true);

  // 空。
  await fireEvent.changeText(screen.getByTestId("base-fee-amount"), "");
  expect(screen.getByTestId("base-fee-save").props.accessibilityState?.disabled).toBe(true);

  // 異なる値なら有効になる。
  await fireEvent.changeText(screen.getByTestId("base-fee-amount"), "6000");
  expect(screen.getByTestId("base-fee-save").props.accessibilityState?.disabled).toBe(false);
});

test("CMP-047: fee-history/[month]は承認済み月では保存・クリアどちらも実行されず、ボタンも無効になる", async () => {
  await approveMonth(db, month);
  __setParams({ month });
  const alertSpy = mockAlert();

  await render(<MonthFeeSettingScreen />);
  await waitFor(() => expect(screen.getByTestId("month-fee-locked-note")).toBeTruthy());

  expect(screen.getByTestId("month-fee-save").props.accessibilityState?.disabled).toBe(true);
  await fireEvent.press(screen.getByTestId("month-fee-save"));
  expect(alertSpy).not.toHaveBeenCalled();
  expect(await getMonthFeeOverride(db, month)).toBeNull();
});

test("CMP-048: fee-history/[month]のsetMonthFeeOverrideがMonthLockedErrorをthrowすると「変更できません」アラートが表示され、再読込される", async () => {
  __setParams({ month });
  const alertSpy = mockAlert();

  await render(<MonthFeeSettingScreen />);
  await waitFor(() => expect(screen.getByTestId("month-fee-amount").props.value).toBe("5000"));

  await fireEvent.changeText(screen.getByTestId("month-fee-amount"), "6000");
  await fireEvent.press(screen.getByTestId("month-fee-save"));
  expect(alertSpy).toHaveBeenCalledWith(
    "この月の月謝額を変更しますか？",
    expect.any(String),
    expect.any(Array),
  );

  // 画面を開いたまま(別画面での操作を想定して)月を承認する。画面自身の
  // approvedステートは明示的な再読込までは追従しないため、まだfalseのまま。
  await approveMonth(db, month);

  await pressAlertButton(alertSpy, "変更する");

  await waitFor(() =>
    expect(alertSpy).toHaveBeenCalledWith("変更できません", expect.any(String)),
  );
  // load()による再読込でロック状態が画面に反映される。
  await waitFor(() => expect(screen.getByTestId("month-fee-locked-note")).toBeTruthy());
  expect(await getMonthFeeOverride(db, month)).toBeNull();
  expect(await getBaseFee(db)).toBe(5000);
});
