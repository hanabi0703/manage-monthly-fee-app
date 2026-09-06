import React from "react";
import { Alert } from "react-native";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react-native";
import type { SQLiteDatabase } from "expo-sqlite";
import { __setTestDb } from "@/__mocks__/expo-sqlite";
import { __router, __setParams, __resetRouterMock } from "@/__mocks__/expo-router";
import { createTestDb } from "@/lib/__tests__/testDb";
import { getMember, upsertMember, type Member } from "@/lib/db";
import EditMemberScreen from "@/app/members/[id]/edit";

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

beforeEach(async () => {
  db = await createTestDb();
  __setTestDb(db);
  member = await upsertMember(db, { name: "山田太郎", furigana: "ヤマダタロウ" });
  __resetRouterMock();
  __setParams({ id: member.id });
});

afterEach(() => {
  jest.restoreAllMocks();
  __setParams({});
});

async function waitForLoaded() {
  await waitFor(() => expect(screen.getByTestId("edit-member-name").props.value).toBe(member.name));
}

test("CMP-034: ひらがな入力中はふりがなに自動反映される(メンバー一覧側と同様の回帰確認)", async () => {
  await render(<EditMemberScreen />);
  await waitForLoaded();

  await fireEvent.changeText(screen.getByTestId("edit-member-name"), "たなか");

  expect(screen.getByTestId("edit-member-furigana").props.value).toBe("タナカ");
});

test("CMP-035: WITHDRAWNへの変更は確認ダイアログ後にupdateMemberStatusが呼ばれ、/membersへ遷移する", async () => {
  const alertSpy = mockAlert();
  await render(<EditMemberScreen />);
  await waitForLoaded();

  await fireEvent.press(screen.getByTestId("edit-member-status-WITHDRAWN"));

  expect(alertSpy).toHaveBeenCalledWith("退会しますか？", expect.any(String), expect.any(Array));
  expect((await getMember(db, member.id))?.status).toBe("ACTIVE");
  expect(__router.replace).not.toHaveBeenCalled();

  await pressAlertButton(alertSpy, "退会する");

  expect((await getMember(db, member.id))?.status).toBe("WITHDRAWN");
  expect(__router.replace).toHaveBeenCalledWith("/members");
});

test("CMP-036: ACTIVE⇔ON_LEAVE間の変更は確認なしで即座にupdateMemberStatusが呼ばれる", async () => {
  const alertSpy = mockAlert();
  await render(<EditMemberScreen />);
  await waitForLoaded();

  await fireEvent.press(screen.getByTestId("edit-member-status-ON_LEAVE"));

  expect(alertSpy).not.toHaveBeenCalled();
  await waitFor(async () => expect((await getMember(db, member.id))?.status).toBe("ON_LEAVE"));
});

test("CMP-037: 現在と同じ状態を選択しても何も実行されない", async () => {
  const alertSpy = mockAlert();
  await render(<EditMemberScreen />);
  await waitForLoaded();

  // memberは初期状態ACTIVEなので、同じACTIVEを選択する。
  await fireEvent.press(screen.getByTestId("edit-member-status-ACTIVE"));

  expect(alertSpy).not.toHaveBeenCalled();
  expect((await getMember(db, member.id))?.status).toBe("ACTIVE");
});

test("CMP-038: 削除確認ダイアログで「削除する」を選択するとdeleteMemberが呼ばれ、/membersへ遷移する", async () => {
  const alertSpy = mockAlert();
  await render(<EditMemberScreen />);
  await waitForLoaded();

  await fireEvent.press(screen.getByTestId("edit-member-delete"));
  expect(alertSpy).toHaveBeenCalledWith("メンバーを削除しますか？", expect.any(String), expect.any(Array));

  await pressAlertButton(alertSpy, "削除する");

  expect(await getMember(db, member.id)).toBeNull();
  expect(__router.replace).toHaveBeenCalledWith("/members");
});

test("CMP-039: 既存の名前と重複してupdateMemberが失敗すると「保存できませんでした」アラートが表示される", async () => {
  await upsertMember(db, { name: "鈴木花子", furigana: "スズキハナコ" });
  const alertSpy = mockAlert();

  await render(<EditMemberScreen />);
  await waitForLoaded();
  await fireEvent.changeText(screen.getByTestId("edit-member-name"), "鈴木花子");
  await fireEvent.changeText(screen.getByTestId("edit-member-furigana"), "スズキハナコ");

  await fireEvent.press(screen.getByTestId("edit-member-submit"));

  await waitFor(() =>
    expect(alertSpy).toHaveBeenCalledWith("保存できませんでした", expect.any(String)),
  );
  expect((await getMember(db, member.id))?.name).toBe("山田太郎");
  expect(__router.back).not.toHaveBeenCalled();
});
