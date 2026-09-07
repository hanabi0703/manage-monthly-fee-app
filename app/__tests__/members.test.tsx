import { render, screen, fireEvent, waitFor, within } from "@testing-library/react-native";
import type { SQLiteDatabase } from "expo-sqlite";
import { __setTestDb } from "@/__mocks__/expo-sqlite";
import { createTestDb } from "@/lib/__tests__/testDb";
import {
  createPaymentForMember,
  setBaseFee,
  setMemberMonthStatus,
  upsertMember,
  type Member,
} from "@/lib/db";
import { currentMonthIso, shiftMonth } from "@/lib/format";
import MembersScreen from "@/app/(tabs)/members";

// expo-router and expo-sqlite are automatically replaced by the manual mocks
// in the root __mocks__/ directory (Jest does this for node_modules packages
// without an explicit jest.mock() call).

let db: SQLiteDatabase;
let member: Member;
const month = currentMonthIso();

beforeEach(async () => {
  db = await createTestDb();
  __setTestDb(db);
  await setBaseFee(db, 5000);
  member = await upsertMember(db, { name: "山田太郎", furigana: "ヤマダタロウ" });
});

test("CMP-020: ひらがな入力中はふりがなに自動反映される", async () => {
  await render(<MembersScreen />);
  await fireEvent.changeText(screen.getByTestId("new-member-name"), "やまだ");

  expect(screen.getByTestId("new-member-furigana").props.value).toBe("ヤマダ");
});

test("CMP-021: 漢字に変換されると自動反映は止まり、直前のふりがなが残る", async () => {
  await render(<MembersScreen />);
  await fireEvent.changeText(screen.getByTestId("new-member-name"), "やまだ");
  expect(screen.getByTestId("new-member-furigana").props.value).toBe("ヤマダ");

  await fireEvent.changeText(screen.getByTestId("new-member-name"), "山田");

  expect(screen.getByTestId("new-member-name").props.value).toBe("山田");
  expect(screen.getByTestId("new-member-furigana").props.value).toBe("ヤマダ");
});

test("CMP-022: MONTHLY区分・当月未払いの場合、当月分もさらに差し引かれる", async () => {
  const lastMonth = shiftMonth(month, -1);
  // 前月に一部だけ支払い済み(5000円のうち2000円)で繰越未払い3000円。
  await createPaymentForMember(db, { memberId: member.id, date: `${lastMonth}-10`, amount: 2000, type: "MONTHLY", note: "" });
  // 当月は一切支払っていない。

  await render(<MembersScreen />);

  // 繰越未払い3000円 + 当月未払い5000円 = 8000円。
  await waitFor(() => expect(screen.getByText("未払金 ¥8,000")).toBeTruthy());
  expect(screen.getByTestId(`member-unpaid-badge-${member.id}`)).toBeTruthy();
});

test("CMP-023: MONTHLY区分・当月一部支払い済みの場合、当月分は二重に差し引かれない", async () => {
  const lastMonth = shiftMonth(month, -1);
  await createPaymentForMember(db, { memberId: member.id, date: `${lastMonth}-10`, amount: 2000, type: "MONTHLY", note: "" });
  await createPaymentForMember(db, { memberId: member.id, date: `${month}-05`, amount: 1000, type: "MONTHLY", note: "" });

  await render(<MembersScreen />);

  // balance = (2000-5000) + (1000-5000) = -7000。二重に差し引かれるバグが
  // あれば -7000-5000=-12000 になってしまうところ、-7000 が正しい。
  await waitFor(() => expect(screen.getByText("未払金 ¥7,000")).toBeTruthy());
});

test("CMP-024: VISITOR区分の場合、当月未払い加算ロジックの対象外になる", async () => {
  await setMemberMonthStatus(db, { memberId: member.id, month, type: "VISITOR" });
  // 月謝の支払い記録は一切無い(balance=0)。MONTHLY区分であれば当月未払いと
  // みなされ ¥5,000 の未払金表示になってしまうところ、VISITORなので対象外。

  await render(<MembersScreen />);

  await waitFor(() => expect(screen.getByTestId(`member-row-${member.id}`)).toBeTruthy());
  const row = within(screen.getByTestId(`member-row-${member.id}`));
  expect(row.getByText("精算済み")).toBeTruthy();
  expect(row.queryByText(/未払金/)).toBeNull();
});

test("CMP-025: 未払いメンバーが一覧の先頭にまとめて表示される", async () => {
  // memberは繰越未払いあり(未払い側)。
  await createPaymentForMember(db, { memberId: member.id, date: `${month}-01`, amount: 2000, type: "MONTHLY", note: "" });
  // memberSettledは月謝を多く払っていて繰越金あり(精算側)。
  const memberSettled = await upsertMember(db, { name: "鈴木花子", furigana: "スズキハナコ" });
  await createPaymentForMember(db, { memberId: memberSettled.id, date: `${month}-02`, amount: 8000, type: "MONTHLY", note: "" });

  await render(<MembersScreen />);
  await waitFor(() => expect(screen.getByTestId(`member-row-${member.id}`)).toBeTruthy());

  const rows = screen.getAllByTestId(/^member-row-/);
  expect(rows.map((r) => r.props.testID)).toEqual([
    `member-row-${member.id}`,
    `member-row-${memberSettled.id}`,
  ]);
});

test("CMP-026: 名前・ふりがなのどちらかが空の場合は追加ボタンが無効になる", async () => {
  await render(<MembersScreen />);

  expect(screen.getByTestId("new-member-submit").props.accessibilityState?.disabled).toBe(true);

  // ふりがなだけ入力(名前が空のまま)。
  await fireEvent.changeText(screen.getByTestId("new-member-furigana"), "タナカ");
  expect(screen.getByTestId("new-member-submit").props.accessibilityState?.disabled).toBe(true);

  // 名前だけ漢字で入力(かな以外なのでふりがなは自動反映されず空のまま)。
  await fireEvent.changeText(screen.getByTestId("new-member-name"), "田中");
  expect(screen.getByTestId("new-member-furigana").props.value).toBe("タナカ");

  // 両方揃って初めて有効になり、upsertMemberが呼ばれる。
  expect(screen.getByTestId("new-member-submit").props.accessibilityState?.disabled).toBe(false);
  await fireEvent.press(screen.getByTestId("new-member-submit"));
  await waitFor(() => expect(screen.getByText("田中")).toBeTruthy());
});
