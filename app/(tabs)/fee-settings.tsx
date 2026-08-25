import { useCallback, useState } from "react";
import { useFocusEffect } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
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
import { EmptyState, Screen, ScreenTitle, SectionLabel } from "@/components/ui";
import { AppCard } from "@/components/AppCard";
import { AppButton } from "@/components/AppButton";
import { AppInput } from "@/components/AppInput";
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

  useFocusEffect(useCallback(() => loadFeeSettings(), [loadFeeSettings]));
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
      <ScrollView contentContainerStyle={styles.wrap} showsVerticalScrollIndicator={false}>
        <ScreenTitle
          title="設定"
          subtitle="月謝額と、月ごとの練習日を管理します。ここでの設定は会計表・繰越金の自動計算に反映されます。"
        />

        <SectionLabel>月謝設定</SectionLabel>
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
            title={feeSubmitting ? "追加中..." : "追加する"}
            onPress={handleSubmitFee}
            disabled={!amount || feeSubmitting}
          />
        </AppCard>
        {settingsLoaded && settings.length === 0 ? (
          <EmptyState>まだ月謝額が設定されていません。</EmptyState>
        ) : (
          <View style={styles.list}>
            {settings.map((s) => (
              <AppCard key={s.id} style={styles.row}>
                <Text style={styles.rowPrimary}>{formatYen(s.amount)}</Text>
                <Text style={styles.rowSecondary}>{formatDate(s.effectiveFrom)} 〜</Text>
              </AppCard>
            ))}
          </View>
        )}

        <View style={styles.sectionGap}>
          <SectionLabel>練習日設定</SectionLabel>
        </View>
        <AppCard style={styles.form}>
          <View style={styles.monthNav}>
            <Pressable
              testID="practice-month-prev"
              style={styles.monthNavButton}
              onPress={() => goToMonth(shiftMonth(selectedMonth, -1))}
              hitSlop={8}
            >
              <Text style={styles.monthNavButtonText}>◀</Text>
            </Pressable>
            <Text style={styles.monthNavLabel}>{formatMonthLabel(selectedMonth)}</Text>
            <Pressable
              testID="practice-month-next"
              style={styles.monthNavButton}
              onPress={() => goToMonth(shiftMonth(selectedMonth, 1))}
              hitSlop={8}
            >
              <Text style={styles.monthNavButtonText}>▶</Text>
            </Pressable>
          </View>

          {practiceDaysLoaded && practiceDays.length === 0 ? (
            <EmptyState>この月の練習日はまだ登録されていません。</EmptyState>
          ) : (
            <View style={styles.list}>
              {practiceDays.map((d) => (
                <View key={d.id} style={styles.dateRow}>
                  <Text style={styles.dateRowText}>{formatDate(d.date)}</Text>
                  <Pressable
                    hitSlop={10}
                    onPress={() => handleDeletePracticeDay(d.id)}
                  >
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
          <AppButton
            testID="practice-day-submit"
            title={practiceDaySubmitting ? "追加中..." : "追加する"}
            onPress={handleAddPracticeDay}
            disabled={practiceDaySubmitting}
          />
        </AppCard>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 20, paddingBottom: 48, gap: 8 },
  form: { gap: 18, marginBottom: 12 },
  sectionGap: { marginTop: 10 },
  list: { gap: 10, marginBottom: 12 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
  },
  rowPrimary: { fontSize: 18, fontWeight: "800", color: colors.text },
  rowSecondary: { fontSize: 14, color: colors.textMuted },
  dateRow: {
    minHeight: 54,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  dateRowText: { color: colors.text, fontWeight: "700" },
  deleteText: { fontSize: 13, color: colors.coral, paddingVertical: 12 },
  monthNav: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 20,
  },
  monthNavButton: {
    minWidth: 44,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    backgroundColor: colors.bg,
  },
  monthNavButtonText: { fontSize: 15, fontWeight: "700", color: colors.text },
  monthNavLabel: {
    fontSize: 18,
    fontWeight: "800",
    color: colors.text,
    minWidth: 110,
    textAlign: "center",
  },
});
