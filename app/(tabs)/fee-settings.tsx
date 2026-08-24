import { useCallback, useState } from "react";
import { useFocusEffect } from "expo-router";
import { FlatList, StyleSheet, Text, TextInput, View } from "react-native";
import { useSQLiteContext } from "expo-sqlite";
import { addFeeSetting, listFeeSettings, type FeeSetting } from "@/lib/db";
import { formatDate, formatYen, todayIso } from "@/lib/format";
import { colors } from "@/lib/theme";
import { Card, EmptyState, PrimaryButton, Screen, ScreenTitle, SectionLabel } from "@/components/ui";
import { DateField } from "@/components/DateField";

export default function FeeSettingsScreen() {
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
        ListHeaderComponent={
          <View style={styles.header}>
            <ScreenTitle
              title="月謝設定"
              subtitle="標準の月謝額と、その適用開始日を管理します。金額が変わる場合はここで新しい行を追加してください。以降、標準額と異なる支払いは各メンバーの繰越金・未払金として自動計算されます。"
            />
            <Card style={styles.form}>
              <View style={styles.field}>
                <Text style={styles.label}>月謝額</Text>
                <TextInput
                  testID="fee-amount"
                  value={amount}
                  onChangeText={(t) => setAmount(t.replace(/[^0-9]/g, ""))}
                  keyboardType="number-pad"
                  placeholder="5000"
                  placeholderTextColor={colors.textFaint}
                  style={styles.input}
                />
              </View>
              <DateField
                testID="fee-date"
                label="適用開始日"
                value={effectiveFrom}
                onChange={setEffectiveFrom}
              />
              <PrimaryButton
                testID="fee-submit"
                label={submitting ? "追加中..." : "追加する"}
                onPress={handleSubmit}
                disabled={!amount || submitting}
              />
            </Card>
            <View style={styles.historyHeader}>
              <SectionLabel>設定履歴</SectionLabel>
            </View>
            {loaded && settings.length === 0 ? (
              <EmptyState>まだ月謝額が設定されていません。</EmptyState>
            ) : null}
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.row}>
            <Text style={styles.amount}>{formatYen(item.amount)}</Text>
            <Text style={styles.date}>{formatDate(item.effectiveFrom)} 〜</Text>
          </View>
        )}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 16, paddingBottom: 32 },
  header: { gap: 16 },
  form: { gap: 14 },
  field: { gap: 6 },
  label: { fontSize: 13, fontWeight: "600", color: colors.text },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    fontSize: 15,
    color: colors.text,
    backgroundColor: colors.card,
  },
  historyHeader: { marginTop: 4 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  separator: { height: 8 },
  amount: { fontSize: 15, fontWeight: "600", color: colors.text },
  date: { fontSize: 13, color: colors.textMuted },
});
