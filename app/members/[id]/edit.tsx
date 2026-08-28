import { useEffect, useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { useSQLiteContext } from "expo-sqlite";
import {
  deleteMember,
  getMember,
  updateMember,
  updateMemberStatus,
  type MemberStatus,
} from "@/lib/db";
import { isKanaOnly, toKatakana } from "@/lib/format";
import { colors } from "@/lib/theme";
import { Screen, ScreenTitle } from "@/components/ui";
import { AppCard } from "@/components/AppCard";
import { AppButton } from "@/components/AppButton";
import { AppInput } from "@/components/AppInput";

const STATUS_OPTIONS: { key: MemberStatus; label: string }[] = [
  { key: "ACTIVE", label: "通常" },
  { key: "ON_LEAVE", label: "休会" },
  { key: "WITHDRAWN", label: "退会" },
];

export default function EditMemberScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const db = useSQLiteContext();
  const router = useRouter();
  const [name, setName] = useState("");
  const [furigana, setFurigana] = useState("");
  const [status, setStatus] = useState<MemberStatus>("ACTIVE");
  const [loaded, setLoaded] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [changingStatus, setChangingStatus] = useState(false);

  useEffect(() => {
    if (!id) return;
    getMember(db, id).then((m) => {
      setName(m?.name ?? "");
      setFurigana(m?.furigana ?? "");
      setStatus(m?.status ?? "ACTIVE");
      setLoaded(true);
    });
  }, [db, id]);

  function handleNameChange(value: string) {
    setName(value);
    // 入力中の名前がひらがな/カタカナのみの間は、その読みをそのまま
    // カタカナのふりがなとして反映する。
    if (isKanaOnly(value)) {
      setFurigana(toKatakana(value));
    }
  }

  async function handleSave() {
    if (!id || !name.trim() || !furigana.trim()) return;
    setSubmitting(true);
    try {
      await updateMember(db, id, { name: name.trim(), furigana: furigana.trim() });
      router.back();
    } catch {
      Alert.alert("保存できませんでした", "この名前はすでに使われている可能性があります。");
    } finally {
      setSubmitting(false);
    }
  }

  function handleStatusChange(next: MemberStatus) {
    if (!id || next === status) return;
    if (next === "WITHDRAWN") {
      Alert.alert(
        "退会しますか？",
        "退会すると会計表・出欠・入力の各画面からこのメンバーが表示されなくなります(支払い履歴は残ります)。設定の「退会メンバー」からいつでも復帰できます。",
        [
          { text: "キャンセル", style: "cancel" },
          {
            text: "退会する",
            style: "destructive",
            onPress: async () => {
              setChangingStatus(true);
              try {
                await updateMemberStatus(db, id, "WITHDRAWN");
                router.replace("/members");
              } finally {
                setChangingStatus(false);
              }
            },
          },
        ],
      );
      return;
    }
    (async () => {
      setChangingStatus(true);
      try {
        await updateMemberStatus(db, id, next);
        setStatus(next);
      } finally {
        setChangingStatus(false);
      }
    })();
  }

  function handleDelete() {
    if (!id) return;
    Alert.alert(
      "メンバーを削除しますか？",
      "支払い履歴・出欠記録もすべて削除され、元に戻せません。",
      [
        { text: "キャンセル", style: "cancel" },
        {
          text: "削除する",
          style: "destructive",
          onPress: async () => {
            setDeleting(true);
            try {
              await deleteMember(db, id);
              router.replace("/members");
            } finally {
              setDeleting(false);
            }
          },
        },
      ],
    );
  }

  if (!loaded) return null;

  return (
    <Screen>
      <ScreenTitle title="メンバー編集" />
      <View style={styles.wrap}>
        <AppCard style={styles.form}>
          <AppInput
            testID="edit-member-name"
            label="名前"
            value={name}
            onChangeText={handleNameChange}
            placeholder="例：山田太郎"
          />
          <AppInput
            testID="edit-member-furigana"
            label="ふりがな（カタカナ）"
            value={furigana}
            onChangeText={(t) => setFurigana(toKatakana(t))}
            placeholder="例：ヤマダタロウ"
          />
          <AppButton
            testID="edit-member-submit"
            title={submitting ? "保存中..." : "保存する"}
            onPress={handleSave}
            disabled={!name.trim() || !furigana.trim() || submitting}
          />
        </AppCard>

        <AppCard style={styles.statusCard}>
          <Text style={styles.statusLabel}>在籍状況</Text>
          <View style={styles.statusRow}>
            {STATUS_OPTIONS.map((opt) => (
              <Pressable
                key={opt.key}
                testID={`edit-member-status-${opt.key}`}
                style={[styles.statusButton, status === opt.key && styles.statusButtonSelected]}
                onPress={() => handleStatusChange(opt.key)}
                disabled={changingStatus}
              >
                <Text
                  style={[
                    styles.statusButtonText,
                    status === opt.key && styles.statusButtonTextSelected,
                  ]}
                >
                  {opt.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </AppCard>

        <AppButton
          testID="edit-member-delete"
          title={deleting ? "削除中..." : "このメンバーを削除する"}
          variant="outline"
          onPress={handleDelete}
          disabled={deleting}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 20, gap: 16 },
  form: { gap: 20 },
  statusCard: { gap: 12 },
  statusLabel: { fontSize: 15, fontWeight: "700", color: colors.text },
  statusRow: { flexDirection: "row", gap: 10 },
  statusButton: {
    flex: 1,
    height: 46,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "#FFFFFF",
  },
  statusButtonSelected: {
    backgroundColor: colors.green,
    borderColor: colors.green,
  },
  statusButtonText: { color: colors.text, fontSize: 14, fontWeight: "700" },
  statusButtonTextSelected: { color: "#FFFFFF" },
});
