import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSQLiteContext } from "expo-sqlite";
import {
  isMonthApproved,
  listAttendanceForDate,
  listMemberMonthStatusForMonth,
  listMembers,
  listPracticeDays,
  MonthLockedError,
  removeAttendance,
  setAttendance,
  type Member,
  type PaymentType,
  type PracticeDay,
} from "@/lib/db";
import { formatDate, formatMonthLabel, todayIso } from "@/lib/format";
import { colors } from "@/lib/theme";
import { EmptyState, Screen, ScreenTitle } from "@/components/ui";
import { AppButton } from "@/components/AppButton";
import { AppCard } from "@/components/AppCard";
import { AppCheckbox } from "@/components/AppCheckbox";
import { PracticeDaySelectField } from "@/components/PracticeDaySelectField";

function pickNearestDate(days: PracticeDay[], today: string): string {
  if (days.length === 0) return "";
  const todayTime = Date.parse(today);
  let best = days[0].date;
  let bestDiff = Math.abs(Date.parse(days[0].date) - todayTime);
  for (const d of days) {
    const diff = Math.abs(Date.parse(d.date) - todayTime);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = d.date;
    }
  }
  return best;
}

export default function AttendanceScreen() {
  const params = useLocalSearchParams<{ date?: string }>();
  const db = useSQLiteContext();
  const router = useRouter();

  const [date, setDate] = useState("");
  const [members, setMembers] = useState<Member[]>([]);
  const [practiceDays, setPracticeDays] = useState<PracticeDay[]>([]);
  const [memberStatus, setMemberStatus] = useState<Record<string, PaymentType>>({});
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [monthApproved, setMonthApproved] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const didInit = useRef(false);
  const lastAppliedParamDate = useRef<string | undefined>(undefined);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      listPracticeDays(db).then((days) => {
        if (cancelled) return;
        setPracticeDays(days);
        if (!didInit.current) {
          didInit.current = true;
          lastAppliedParamDate.current = params.date;
          const initial =
            params.date && days.some((d) => d.date === params.date)
              ? params.date
              : pickNearestDate(days, todayIso());
          setDate(initial);
        } else if (params.date && params.date !== lastAppliedParamDate.current) {
          // 会計表の日付列をタップして遷移してきた場合、出欠タブが既に
          // マウント済みでも(=タブ切り替えでは画面が再マウントされないため)
          // クリックした日付を反映する。
          lastAppliedParamDate.current = params.date;
          if (days.some((d) => d.date === params.date)) {
            setDate(params.date);
          }
        }
      });
      return () => {
        cancelled = true;
      };
    }, [db, params.date]),
  );

  useEffect(() => {
    if (!date) {
      setLoaded(true);
      return;
    }
    let cancelled = false;
    setLoaded(false);
    Promise.all([
      listMembers(db),
      listAttendanceForDate(db, date),
      listMemberMonthStatusForMonth(db, date.slice(0, 7)),
      isMonthApproved(db, date.slice(0, 7)),
    ]).then(([m, attendance, statusMap, approved]) => {
      if (cancelled) return;
      const initial: Record<string, boolean> = {};
      for (const member of m) {
        initial[member.id] = attendance.some((a) => a.memberId === member.id);
      }
      setMembers(m);
      setChecked(initial);
      setMemberStatus(statusMap);
      setMonthApproved(approved);
      setLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, [db, date]);

  function handleDateChange(newDate: string) {
    setDate(newDate);
    setFeedback(null);
    router.setParams({ date: newDate });
  }

  const checkedCount = useMemo(
    () => Object.values(checked).filter(Boolean).length,
    [checked],
  );
  const visitorCheckedCount = useMemo(
    () =>
      members.filter((m) => checked[m.id] && (memberStatus[m.id] ?? "MONTHLY") === "VISITOR")
        .length,
    [members, checked, memberStatus],
  );

  function toggleChecked(memberId: string) {
    if (monthApproved) return;
    setChecked((prev) => ({ ...prev, [memberId]: !(prev[memberId] ?? false) }));
    setFeedback(null);
  }

  async function handleSave() {
    if (monthApproved) return;
    setSaving(true);
    try {
      const ops: Promise<void>[] = [];
      for (const member of members) {
        if (checked[member.id]) {
          ops.push(setAttendance(db, { memberId: member.id, date }));
        } else {
          ops.push(removeAttendance(db, { memberId: member.id, date }));
        }
      }
      await Promise.all(ops);
      setFeedback(`✓ ${formatDate(date)}の出欠を保存しました`);
    } catch (err) {
      if (err instanceof MonthLockedError) {
        Alert.alert(
          "保存できません",
          `${formatMonthLabel(err.month)}は承認済みのため、出欠を変更できません。`,
        );
        setMonthApproved(true);
        return;
      }
      throw err;
    } finally {
      setSaving(false);
    }
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.wrap} showsVerticalScrollIndicator={false}>
        <ScreenTitle title="出欠確認" subtitle="練習日ごとに出欠を記録します。" />
        <PracticeDaySelectField
          testID="attendance-date"
          label="日付"
          value={date}
          onChange={handleDateChange}
          practiceDays={practiceDays}
        />
        <Text style={styles.subtitle}>
          支払いの記録は「入力」タブから別途行ってください。
        </Text>
        <Text style={styles.subtitleNote}>
          ビジターとして出席した人は、その場で支払い義務が発生します（未払いとして会計表に表示されます）。区分は会計表の名前横で変更できます。
        </Text>
        <View style={styles.countRow}>
          <Text style={styles.countText}>{checkedCount}人 出席</Text>
          {visitorCheckedCount > 0 ? (
            <Text style={styles.countTextVisitor}>うちビジター {visitorCheckedCount}人</Text>
          ) : null}
        </View>
        {monthApproved ? (
          <Text testID="attendance-locked-note" style={styles.lockedNote}>
            この月は承認済みのため、出欠を変更できません。
          </Text>
        ) : null}
        {loaded && date && members.length === 0 ? (
          <EmptyState>
            まだメンバーが登録されていません。「メンバー」タブから追加してください。
          </EmptyState>
        ) : null}
        {loaded && members.length > 0 ? (
          <AppCard style={styles.listCard}>
            {members.map((item, index) => {
              const isChecked = checked[item.id] ?? false;
              const isVisitor = (memberStatus[item.id] ?? "MONTHLY") === "VISITOR";
              return (
                <Pressable
                  key={item.id}
                  testID={`attendance-row-${item.id}`}
                  style={[styles.row, index > 0 && styles.rowDivider]}
                  onPress={() => toggleChecked(item.id)}
                  disabled={monthApproved}
                >
                  <View style={styles.rowLeft}>
                    <AppCheckbox
                      testID={`attendance-checkbox-${item.id}`}
                      checked={isChecked}
                      onToggle={() => toggleChecked(item.id)}
                    />
                    <Text style={styles.name}>{item.name}</Text>
                  </View>
                  <View style={[styles.statusChip, isVisitor && styles.statusChipVisitor]}>
                    <Text style={[styles.statusChipText, isVisitor && styles.statusChipTextVisitor]}>
                      {isVisitor ? "ビジター" : "月謝"}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </AppCard>
        ) : null}
        {loaded && members.length > 0 ? (
          <View style={styles.footer}>
            <AppButton
              testID="attendance-save"
              title={saving ? "保存中..." : "保存する"}
              onPress={handleSave}
              disabled={saving || monthApproved}
            />
            {feedback ? (
              <Text testID="attendance-feedback" style={styles.feedbackText}>
                {feedback}
              </Text>
            ) : null}
          </View>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 20, paddingBottom: 48, gap: 10 },
  subtitle: { fontSize: 13, color: colors.textMuted, lineHeight: 19, marginTop: 6 },
  subtitleNote: { fontSize: 12, color: colors.unpaidText, lineHeight: 18 },
  lockedNote: { fontSize: 12, color: colors.textMuted, lineHeight: 18, fontWeight: "700" },
  countRow: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 4 },
  countText: { fontSize: 13, color: colors.green, fontWeight: "700" },
  countTextVisitor: { fontSize: 13, color: colors.unpaidText, fontWeight: "700" },
  listCard: { padding: 0, overflow: "hidden" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    paddingHorizontal: 18,
  },
  rowDivider: { borderTopWidth: 1, borderTopColor: colors.border },
  rowLeft: { flexDirection: "row", alignItems: "center", gap: 14 },
  name: { fontSize: 16, fontWeight: "700", color: colors.text },
  statusChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: colors.monthlyBg,
  },
  statusChipVisitor: {
    backgroundColor: colors.visitorBg,
    borderColor: colors.visitorText,
  },
  statusChipText: { fontSize: 12, fontWeight: "700", color: colors.monthlyText },
  statusChipTextVisitor: { color: colors.visitorText },
  footer: { marginTop: 4, gap: 12 },
  feedbackText: {
    textAlign: "center",
    color: colors.green,
    fontWeight: "700",
    fontSize: 14,
  },
});
