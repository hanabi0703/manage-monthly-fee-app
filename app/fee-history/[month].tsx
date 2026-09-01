import { useCallback, useState } from "react";
import { Stack, useFocusEffect, useLocalSearchParams } from "expo-router";
import { Alert, Keyboard, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSQLiteContext } from "expo-sqlite";
import {
  clearMonthFeeOverride,
  getBaseFee,
  getMonthFeeOverride,
  isMonthApproved,
  MonthLockedError,
  setMonthFeeOverride,
} from "@/lib/db";
import { formatMonthLabel, formatYen } from "@/lib/format";
import { colors } from "@/lib/theme";
import { Screen, ScreenTitle } from "@/components/ui";
import { AppCard } from "@/components/AppCard";
import { AppButton } from "@/components/AppButton";
import { AppInput } from "@/components/AppInput";

export default function MonthFeeSettingScreen() {
  const { month } = useLocalSearchParams<{ month: string }>();
  const db = useSQLiteContext();

  const [baseFee, setBaseFee] = useState(0);
  const [override, setOverride] = useState<number | null>(null);
  const [amount, setAmount] = useState("");
  const [approved, setApproved] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    if (!month) return () => {};
    let cancelled = false;
    Promise.all([getBaseFee(db), getMonthFeeOverride(db, month), isMonthApproved(db, month)]).then(
      ([base, monthOverride, monthApproved]) => {
        if (cancelled) return;
        setBaseFee(base);
        setOverride(monthOverride);
        setAmount(String(monthOverride ?? base));
        setApproved(monthApproved);
        setLoaded(true);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [db, month]);

  useFocusEffect(load);

  async function handleSave() {
    if (!month || approved) return;
    const amountNum = Number(amount);
    if (!amount || !Number.isFinite(amountNum) || amountNum < 0) return;
    Keyboard.dismiss();
    setSaving(true);
    try {
      await setMonthFeeOverride(db, month, amountNum);
      load();
    } catch (err) {
      if (err instanceof MonthLockedError) {
        Alert.alert("変更できません", "この月は承認済みのため、月謝を変更できません。");
        load();
        return;
      }
      throw err;
    } finally {
      setSaving(false);
    }
  }

  async function handleClear() {
    if (!month || approved) return;
    setSaving(true);
    try {
      await clearMonthFeeOverride(db, month);
      load();
    } catch (err) {
      if (err instanceof MonthLockedError) {
        Alert.alert("変更できません", "この月は承認済みのため、月謝を変更できません。");
        load();
        return;
      }
      throw err;
    } finally {
      setSaving(false);
    }
  }

  const effectiveFee = override ?? baseFee;

  return (
    <Screen>
      <Stack.Screen options={{ title: "月謝設定" }} />
      <ScrollView contentContainerStyle={styles.wrap} showsVerticalScrollIndicator={false}>
        <ScreenTitle
          title={month ? formatMonthLabel(month) : ""}
          subtitle="この月だけ月謝額を変更したい場合はここで設定してください。基本の月謝額は「設定」タブで変更できます。"
        />

        <AppCard style={styles.summaryCard}>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>基本の月謝額</Text>
            <Text style={styles.summaryValue}>{formatYen(baseFee)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>この月の月謝額</Text>
            <Text style={[styles.summaryValue, override !== null && styles.summaryValueOverride]}>
              {formatYen(effectiveFee)}
            </Text>
          </View>
          {override !== null ? (
            <Text style={styles.overrideNote}>この月はイレギュラー設定が適用されています。</Text>
          ) : null}
          {approved ? (
            <Text testID="month-fee-locked-note" style={styles.lockedNote}>
              この月は承認済みのため、月謝を変更できません。
            </Text>
          ) : null}
        </AppCard>

        {loaded ? (
          <AppCard style={styles.form}>
            <AppInput
              testID="month-fee-amount"
              label="この月の月謝額"
              value={amount}
              onChangeText={(t) => setAmount(t.replace(/[^0-9]/g, ""))}
              keyboardType="number-pad"
              placeholder="5000"
              editable={!approved}
            />
            <AppButton
              testID="month-fee-save"
              title={saving ? "保存中..." : "この月だけ変更する"}
              onPress={handleSave}
              disabled={!amount || saving || approved}
            />
            {override !== null ? (
              <AppButton
                testID="month-fee-clear"
                title="基本の月謝額に戻す"
                variant="outline"
                onPress={handleClear}
                disabled={saving || approved}
              />
            ) : null}
          </AppCard>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 20, paddingBottom: 48 },
  summaryCard: { gap: 10, marginBottom: 18 },
  summaryRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  summaryLabel: { fontSize: 14, color: colors.textMuted },
  summaryValue: { fontSize: 18, fontWeight: "800", color: colors.text },
  summaryValueOverride: { color: colors.green },
  overrideNote: { fontSize: 12, color: colors.green, marginTop: 2 },
  lockedNote: { fontSize: 12, color: colors.textMuted, fontWeight: "700", marginTop: 2 },
  form: { gap: 18 },
});
