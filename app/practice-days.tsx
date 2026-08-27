import { useCallback, useState } from "react";
import { useFocusEffect } from "expo-router";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSQLiteContext } from "expo-sqlite";
import {
  addPracticeDay,
  deletePracticeDay,
  listAttendanceForDate,
  listPaymentsForDate,
  listPracticeDaysForMonth,
  removeAttendance,
  type PracticeDay,
} from "@/lib/db";
import { currentMonthIso, formatDate, formatMonthLabel, shiftMonth } from "@/lib/format";
import { colors } from "@/lib/theme";
import { EmptyState, Screen, ScreenTitle } from "@/components/ui";
import { AppCard } from "@/components/AppCard";
import { AppButton } from "@/components/AppButton";
import { DateField } from "@/components/DateField";

export default function PracticeDaysScreen() {
  const db = useSQLiteContext();

  const [selectedMonth, setSelectedMonth] = useState(currentMonthIso());
  const [practiceDays, setPracticeDays] = useState<PracticeDay[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [newPracticeDay, setNewPracticeDay] = useState(`${currentMonthIso()}-01`);
  const [submitting, setSubmitting] = useState(false);

  const loadPracticeDays = useCallback(
    (month: string) => {
      let cancelled = false;
      listPracticeDaysForMonth(db, month).then((rows) => {
        if (cancelled) return;
        setPracticeDays(rows);
        setLoaded(true);
      });
      return () => {
        cancelled = true;
      };
    },
    [db],
  );

  useFocusEffect(
    useCallback(() => loadPracticeDays(selectedMonth), [loadPracticeDays, selectedMonth]),
  );

  function goToMonth(month: string) {
    setSelectedMonth(month);
    setNewPracticeDay(`${month}-01`);
  }

  async function handleAdd() {
    if (newPracticeDay.length !== 10) return;
    setSubmitting(true);
    try {
      await addPracticeDay(db, newPracticeDay);
      const dayMonth = newPracticeDay.slice(0, 7);
      if (dayMonth !== selectedMonth) {
        setSelectedMonth(dayMonth);
      } else {
        loadPracticeDays(selectedMonth);
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: string, date: string) {
    const [attendanceList, paymentsList] = await Promise.all([
      listAttendanceForDate(db, date),
      listPaymentsForDate(db, date),
    ]);

    if (paymentsList.length > 0) {
      Alert.alert(
        "削除できません",
        `${formatDate(date)}はすでに支払いが記録されているメンバーがいます（${paymentsList.length}件）。先にその支払いを削除してから練習日を削除してください。`,
      );
      return;
    }

    if (attendanceList.length > 0) {
      Alert.alert(
        "練習日を削除しますか？",
        `${formatDate(date)}には出欠記録があります（${attendanceList.length}人）。削除すると、その日の参加者は全員欠席として扱われます。よろしいですか？`,
        [
          { text: "キャンセル", style: "cancel" },
          {
            text: "削除する",
            style: "destructive",
            onPress: async () => {
              await Promise.all(
                attendanceList.map((a) => removeAttendance(db, { memberId: a.memberId, date })),
              );
              await deletePracticeDay(db, id);
              loadPracticeDays(selectedMonth);
            },
          },
        ],
      );
      return;
    }

    await deletePracticeDay(db, id);
    loadPracticeDays(selectedMonth);
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.wrap} showsVerticalScrollIndicator={false}>
        <ScreenTitle
          title="練習日設定"
          subtitle="月ごとの練習日を管理します。ここで登録した日は会計表の列として表示されます。"
        />
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

          {loaded && practiceDays.length === 0 ? (
            <EmptyState>この月の練習日はまだ登録されていません。</EmptyState>
          ) : (
            <View style={styles.list}>
              {practiceDays.map((d) => (
                <View key={d.id} style={styles.dateRow}>
                  <Text style={styles.dateRowText}>{formatDate(d.date)}</Text>
                  <Pressable hitSlop={10} onPress={() => handleDelete(d.id, d.date)}>
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
            title={submitting ? "追加中..." : "追加する"}
            onPress={handleAdd}
            disabled={submitting}
          />
        </AppCard>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 20, paddingBottom: 48 },
  form: { gap: 18 },
  list: { gap: 10 },
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
