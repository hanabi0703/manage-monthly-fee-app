import { useCallback, useState } from "react";
import { useFocusEffect } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSQLiteContext } from "expo-sqlite";
import {
  addFeeSetting,
  addPracticeDay,
  deletePracticeDay,
  listFeeSettings,
  listPracticeDaysForMonth,
  type FeeSetting,
  type PracticeDay,
} from "@/lib/db";
import {
  currentMonthIso,
  formatDate,
  formatMonthLabel,
  formatYen,
  shiftMonth,
  todayIso,
} from "@/lib/format";
import { colors } from "@/lib/theme";
import { Card, EmptyState, PrimaryButton, Screen, ScreenTitle, SectionLabel } from "@/components/ui";
import { DateField } from "@/components/DateField";

export default function SettingsScreen() {
  const db = useSQLiteContext();

  const [settings, setSettings] = useState<FeeSetting[]>([]);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [amount, setAmount] = useState("");
  const [effectiveFrom, setEffectiveFrom] = useState(todayIso());
  const [feeSubmitting, setFeeSubmitting] = useState(false);

  const [selectedMonth, setSelectedMonth] = useState(currentMonthIso());
  const [practiceDays, setPracticeDays] = useState<PracticeDay[]>([]);
  const [practiceDaysLoaded, setPracticeDaysLoaded] = useState(false);
  const [newPracticeDay, setNewPracticeDay] = useState(`${currentMonthIso()}-01`);
  const [practiceDaySubmitting, setPracticeDaySubmitting] = useState(false);

  const loadFeeSettings = useCallback(() => {
    let cancelled = false;
    listFeeSettings(db).then((rows) => {
      if (cancelled) return;
      setSettings([...rows].sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom)));
      setSettingsLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, [db]);

  const loadPracticeDays = useCallback(
    (month: string) => {
      let cancelled = false;
      listPracticeDaysForMonth(db, month).then((rows) => {
        if (cancelled) return;
        setPracticeDays(rows);
        setPracticeDaysLoaded(true);
      });
      return () => {
        cancelled = true;
      };
    },
    [db],
  );

  useFocusEffect(
    useCallback(() => loadFeeSettings(), [loadFeeSettings]),
  );
  useFocusEffect(
    useCallback(() => loadPracticeDays(selectedMonth), [loadPracticeDays, selectedMonth]),
  );

  async function handleSubmitFee() {
    const amountNum = Number(amount);
    if (!amount || !Number.isFinite(amountNum) || amountNum < 0) return;
    setFeeSubmitting(true);
    try {
      await addFeeSetting(db, { amount: amountNum, effectiveFrom });
      setAmount("");
      loadFeeSettings();
    } finally {
      setFeeSubmitting(false);
    }
  }

  function goToMonth(month: string) {
    setSelectedMonth(month);
    setNewPracticeDay(`${month}-01`);
  }

  async function handleAddPracticeDay() {
    if (newPracticeDay.length !== 10) return;
    setPracticeDaySubmitting(true);
    try {
      await addPracticeDay(db, newPracticeDay);
      const dayMonth = newPracticeDay.slice(0, 7);
      if (dayMonth !== selectedMonth) {
        setSelectedMonth(dayMonth);
      } else {
        loadPracticeDays(selectedMonth);
      }
    } finally {
      setPracticeDaySubmitting(false);
    }
  }

  async function handleDeletePracticeDay(id: string) {
    await deletePracticeDay(db, id);
    loadPracticeDays(selectedMonth);
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.wrap}>
        <ScreenTitle
          title="設定"
          subtitle="月謝額と、月ごとの練習日を管理します。ここでの設定は会計表・繰越金の自動計算に反映されます。"
        />

        <SectionLabel>月謝設定</SectionLabel>
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
            label={feeSubmitting ? "追加中..." : "追加する"}
            onPress={handleSubmitFee}
            disabled={!amount || feeSubmitting}
          />
        </Card>
        {settingsLoaded && settings.length === 0 ? (
          <EmptyState>まだ月謝額が設定されていません。</EmptyState>
        ) : (
          <View style={styles.list}>
            {settings.map((s) => (
              <View key={s.id} style={styles.row}>
                <Text style={styles.rowPrimary}>{formatYen(s.amount)}</Text>
                <Text style={styles.rowSecondary}>{formatDate(s.effectiveFrom)} 〜</Text>
              </View>
            ))}
          </View>
        )}

        <View style={styles.sectionGap}>
          <SectionLabel>練習日設定</SectionLabel>
        </View>
        <Card style={styles.form}>
          <View style={styles.monthNav}>
            <Pressable
              testID="practice-month-prev"
              style={styles.monthNavButton}
              onPress={() => goToMonth(shiftMonth(selectedMonth, -1))}
            >
              <Text style={styles.monthNavButtonText}>◀</Text>
            </Pressable>
            <Text style={styles.monthNavLabel}>{formatMonthLabel(selectedMonth)}</Text>
            <Pressable
              testID="practice-month-next"
              style={styles.monthNavButton}
              onPress={() => goToMonth(shiftMonth(selectedMonth, 1))}
            >
              <Text style={styles.monthNavButtonText}>▶</Text>
            </Pressable>
          </View>

          {practiceDaysLoaded && practiceDays.length === 0 ? (
            <EmptyState>この月の練習日はまだ登録されていません。</EmptyState>
          ) : (
            <View style={styles.list}>
              {practiceDays.map((d) => (
                <View key={d.id} style={styles.row}>
                  <Text style={styles.rowPrimary}>{formatDate(d.date)}</Text>
                  <Pressable onPress={() => handleDeletePracticeDay(d.id)}>
                    <Text style={styles.deleteText}>削除</Text>
                  </Pressable>
                </View>
              ))}
            </View>
          )}

          <DateField
            testID="practice-day-date"
            label="練習日を追加"
            value={newPracticeDay}
            onChange={setNewPracticeDay}
          />
          <PrimaryButton
            testID="practice-day-submit"
            label={practiceDaySubmitting ? "追加中..." : "追加する"}
            onPress={handleAddPracticeDay}
            disabled={practiceDaySubmitting}
          />
        </Card>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 16, paddingBottom: 32, gap: 8 },
  form: { gap: 14, marginBottom: 8 },
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
  sectionGap: { marginTop: 8 },
  list: { gap: 8, marginBottom: 8 },
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
  rowPrimary: { fontSize: 15, fontWeight: "600", color: colors.text },
  rowSecondary: { fontSize: 13, color: colors.textMuted },
  deleteText: { fontSize: 12, color: colors.textFaint },
  monthNav: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 20,
  },
  monthNavButton: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 8,
    backgroundColor: colors.neutralBg,
  },
  monthNavButtonText: { fontSize: 14, fontWeight: "700", color: colors.text },
  monthNavLabel: { fontSize: 16, fontWeight: "700", color: colors.text, minWidth: 110, textAlign: "center" },
});
