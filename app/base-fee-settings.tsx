import { useCallback, useState } from "react";
import { useFocusEffect } from "expo-router";
import { Alert, Keyboard, ScrollView, StyleSheet, Text } from "react-native";
import { useSQLiteContext } from "expo-sqlite";
import { getBaseFee, setBaseFee } from "@/lib/db";
import { formatYen } from "@/lib/format";
import { colors } from "@/lib/theme";
import { Screen, ScreenTitle } from "@/components/ui";
import { AppCard } from "@/components/AppCard";
import { AppButton } from "@/components/AppButton";
import { AppInput } from "@/components/AppInput";

export default function BaseFeeSettingsScreen() {
  const db = useSQLiteContext();
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

  function handleSave() {
    const amountNum = Number(baseFee);
    if (!baseFee || !Number.isFinite(amountNum) || amountNum < 0) return;
    Keyboard.dismiss();
    Alert.alert(
      "月謝額を変更しますか？",
      `基本の月謝額を${formatYen(amountNum)}に変更します。`,
      [
        { text: "キャンセル", style: "cancel" },
        {
          text: "変更する",
          onPress: async () => {
            setSaving(true);
            try {
              await setBaseFee(db, amountNum);
              setSavedFee(amountNum);
            } finally {
              setSaving(false);
            }
          },
        },
      ],
    );
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.wrap} showsVerticalScrollIndicator={false}>
        <ScreenTitle title="月謝額設定" subtitle="毎月の基本の月謝額を設定します。" />
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
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 20, paddingBottom: 48, gap: 18 },
  feeCard: { gap: 16 },
  feeNote: { fontSize: 12, color: colors.textMuted, lineHeight: 18 },
});
