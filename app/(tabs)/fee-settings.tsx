import { useCallback, useState } from "react";
import { useFocusEffect, useRouter } from "expo-router";
import { Keyboard, Pressable, StyleSheet, Text, View } from "react-native";
import { useSQLiteContext } from "expo-sqlite";
import { getBaseFee, setBaseFee } from "@/lib/db";
import { colors } from "@/lib/theme";
import { Screen, ScreenTitle, SectionLabel } from "@/components/ui";
import { AppCard } from "@/components/AppCard";
import { AppButton } from "@/components/AppButton";
import { AppInput } from "@/components/AppInput";
import { DoodleIcon, type DoodleIconName } from "@/components/DoodleIcon";

const menuItems: {
  key: string;
  label: string;
  description: string;
  icon: DoodleIconName;
  href: "/practice-days" | "/withdrawn-members";
}[] = [
  {
    key: "practice-days",
    label: "練習日設定",
    description: "月ごとの練習日を登録・削除します。",
    icon: "calendar",
    href: "/practice-days",
  },
  {
    key: "withdrawn-members",
    label: "退会メンバー",
    description: "退会したメンバーの確認・復帰を行います。",
    icon: "members",
    href: "/withdrawn-members",
  },
];

export default function SettingsScreen() {
  const db = useSQLiteContext();
  const router = useRouter();
  const [baseFee, setBaseFeeInput] = useState("");
  const [savedFee, setSavedFee] = useState(0);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    let cancelled = false;
    getBaseFee(db).then((fee) => {
      if (cancelled) return;
      setSavedFee(fee);
      setBaseFeeInput(String(fee));
    });
    return () => {
      cancelled = true;
    };
  }, [db]);

  useFocusEffect(load);

  async function handleSave() {
    const amountNum = Number(baseFee);
    if (!baseFee || !Number.isFinite(amountNum) || amountNum < 0) return;
    Keyboard.dismiss();
    setSaving(true);
    try {
      await setBaseFee(db, amountNum);
      setSavedFee(amountNum);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Screen>
      <ScreenTitle title="設定" subtitle="各種設定はここから行えます。" />
      <View style={styles.list}>
        <SectionLabel>月謝の基本設定</SectionLabel>
        <AppCard style={styles.feeCard}>
          <AppInput
            testID="base-fee-amount"
            label="月謝額（基本）"
            value={baseFee}
            onChangeText={(t) => setBaseFeeInput(t.replace(/[^0-9]/g, ""))}
            keyboardType="number-pad"
            placeholder="5000"
          />
          <Text style={styles.feeNote}>
            毎月の基本の月謝額です。特定の月だけ金額を変える場合は、会計表の月謝設定から変更できます。
          </Text>
          <AppButton
            testID="base-fee-save"
            title={saving ? "保存中..." : "保存する"}
            onPress={handleSave}
            disabled={!baseFee || Number(baseFee) === savedFee || saving}
          />
        </AppCard>

        {menuItems.map((item) => (
          <Pressable
            key={item.key}
            testID={`settings-menu-${item.key}`}
            onPress={() => router.push(item.href)}
          >
            <AppCard style={styles.row}>
              <View style={styles.rowLeft}>
                <DoodleIcon name={item.icon} size={24} color={colors.tabInactive} />
                <View>
                  <Text style={styles.label}>{item.label}</Text>
                  <Text style={styles.description}>{item.description}</Text>
                </View>
              </View>
              <Text style={styles.chevron}>›</Text>
            </AppCard>
          </Pressable>
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { padding: 20, paddingTop: 4, gap: 12 },
  feeCard: { gap: 16 },
  feeNote: { fontSize: 12, color: colors.textMuted, lineHeight: 18 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  rowLeft: { flexDirection: "row", alignItems: "center", gap: 14, flexShrink: 1 },
  label: { fontSize: 17, fontWeight: "700", color: colors.text },
  description: { fontSize: 12, color: colors.textMuted, marginTop: 4, maxWidth: 260 },
  chevron: { fontSize: 26, color: colors.textMuted },
});
