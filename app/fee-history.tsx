import { useCallback, useState } from "react";
import { useFocusEffect } from "expo-router";
import { FlatList, StyleSheet, Text, View } from "react-native";
import { useSQLiteContext } from "expo-sqlite";
import { addFeeSetting, listFeeSettings, type FeeSetting } from "@/lib/db";
import { formatDate, formatYen, todayIso } from "@/lib/format";
import { colors } from "@/lib/theme";
import { EmptyState, Screen, ScreenTitle, SectionLabel } from "@/components/ui";
import { AppCard } from "@/components/AppCard";
import { AppButton } from "@/components/AppButton";
import { AppInput } from "@/components/AppInput";
import { DateField } from "@/components/DateField";

export default function FeeHistoryScreen() {
  const db = useSQLiteContext();
  const [settings, setSettings] = useState<FeeSetting[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [amount, setAmount] = useState("");
  const [effectiveFrom, setEffectiveFrom] = useState(todayIso());
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(() => {
    let cancelled = false;
    listFeeSettings(db).then((rows) => {
      if (cancelled) return;
      setSettings([...rows].sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom)));
      setLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, [db]);

  useFocusEffect(load);

  async function handleSubmit() {
    const amountNum = Number(amount);
    if (!amount || !Number.isFinite(amountNum) || amountNum < 0) return;
    setSubmitting(true);
    try {
      await addFeeSetting(db, { amount: amountNum, effectiveFrom });
      setAmount("");
      load();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Screen>
      <FlatList
        contentContainerStyle={styles.wrap}
        data={settings}
        keyExtractor={(s) => s.id}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View style={styles.header}>
            <ScreenTitle
              title="月謝設定"
              subtitle="標準の月謝額と、その適用開始日を管理します。金額が変わる場合はここで新しい行を追加してください。以降、標準額と異なる支払いは各メンバーの繰越金・未払金として自動計算されます。"
            />
            <AppCard style={styles.form}>
              <AppInput
                testID="fee-amount"
                label="月謝額"
                value={amount}
                onChangeText={(t) => setAmount(t.replace(/[^0-9]/g, ""))}
                keyboardType="number-pad"
                placeholder="5000"
              />
              <DateField
                testID="fee-date"
                label="適用開始日"
                value={effectiveFrom}
                onChange={setEffectiveFrom}
              />
              <AppButton
                testID="fee-submit"
                title={submitting ? "追加中..." : "追加する"}
                onPress={handleSubmit}
                disabled={!amount || submitting}
              />
            </AppCard>
            <View style={styles.historyHeader}>
              <SectionLabel>設定履歴</SectionLabel>
            </View>
            {loaded && settings.length === 0 ? (
              <EmptyState>まだ月謝額が設定されていません。</EmptyState>
            ) : null}
          </View>
        }
        renderItem={({ item }) => (
          <AppCard style={styles.row}>
            <Text style={styles.rowPrimary}>{formatYen(item.amount)}</Text>
            <Text style={styles.rowSecondary}>{formatDate(item.effectiveFrom)} 〜</Text>
          </AppCard>
        )}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 20, paddingBottom: 48 },
  header: { gap: 16 },
  form: { gap: 18 },
  historyHeader: { marginTop: 4 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
  },
  separator: { height: 10 },
  rowPrimary: { fontSize: 18, fontWeight: "800", color: colors.text },
  rowSecondary: { fontSize: 14, color: colors.textMuted },
});
