import { useCallback, useMemo, useState } from "react";
import {
  Stack,
  useFocusEffect,
  useLocalSearchParams,
  useRouter,
} from "expo-router";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useSQLiteContext } from "expo-sqlite";
import {
  listAttendanceForDate,
  listMemberMonthStatusForMonth,
  listMembers,
  removeAttendance,
  setAttendance,
  type Member,
  type PaymentType,
} from "@/lib/db";
import { todayIso } from "@/lib/format";
import { colors } from "@/lib/theme";
import { EmptyState, Screen } from "@/components/ui";
import { AppButton } from "@/components/AppButton";
import { AppCheckbox } from "@/components/AppCheckbox";
import { DateField } from "@/components/DateField";

export default function AttendanceScreen() {
  const params = useLocalSearchParams<{ date?: string }>();
  const db = useSQLiteContext();
  const router = useRouter();

  const [date, setDate] = useState(params.date || todayIso());
  const [members, setMembers] = useState<Member[]>([]);
  const [memberStatus, setMemberStatus] = useState<Record<string, PaymentType>>({});
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(
    (forDate: string) => {
      let cancelled = false;
      Promise.all([
        listMembers(db),
        listAttendanceForDate(db, forDate),
        listMemberMonthStatusForMonth(db, forDate.slice(0, 7)),
      ]).then(([m, attendance, statusMap]) => {
        if (cancelled) return;
        const initial: Record<string, boolean> = {};
        for (const member of m) {
          initial[member.id] = attendance.some((a) => a.memberId === member.id);
        }
        setMembers(m);
        setChecked(initial);
        setMemberStatus(statusMap);
        setLoaded(true);
      });
      return () => {
        cancelled = true;
      };
    },
    [db],
  );

  useFocusEffect(useCallback(() => load(date), [load, date]));

  function handleDateChange(newDate: string) {
    setDate(newDate);
    setLoaded(false);
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
    setChecked((prev) => ({ ...prev, [memberId]: !(prev[memberId] ?? false) }));
  }

  async function handleSave() {
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
      router.back();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Screen>
      <Stack.Screen options={{ title: "出欠確認" }} />
      <FlatList
        contentContainerStyle={styles.wrap}
        data={loaded ? members : []}
        keyExtractor={(m) => m.id}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View style={styles.header}>
            <DateField testID="attendance-date" label="日付" value={date} onChange={handleDateChange} />
            <Text style={styles.subtitle}>
              出欠を記録します。支払いの記録は「入力」タブから別途行ってください。
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
            {loaded && members.length === 0 ? (
              <EmptyState>
                まだメンバーが登録されていません。「メンバー」タブから追加してください。
              </EmptyState>
            ) : null}
          </View>
        }
        renderItem={({ item }) => {
          const isChecked = checked[item.id] ?? false;
          const isVisitor = (memberStatus[item.id] ?? "MONTHLY") === "VISITOR";
          return (
            <Pressable
              testID={`attendance-row-${item.id}`}
              style={styles.row}
              onPress={() => toggleChecked(item.id)}
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
        }}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListFooterComponent={
          loaded && members.length > 0 ? (
            <View style={styles.footer}>
              <AppButton
                testID="attendance-save"
                title={saving ? "保存中..." : "保存する"}
                onPress={handleSave}
                disabled={saving}
              />
            </View>
          ) : null
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 20, paddingBottom: 48 },
  header: { gap: 8, marginBottom: 8 },
  subtitle: { fontSize: 13, color: colors.textMuted, lineHeight: 19, marginTop: 6 },
  subtitleNote: { fontSize: 12, color: colors.unpaidText, lineHeight: 18 },
  countRow: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 4 },
  countText: { fontSize: 13, color: colors.green, fontWeight: "700" },
  countTextVisitor: { fontSize: 13, color: colors.unpaidText, fontWeight: "700" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    minHeight: 54,
  },
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
  separator: { height: 10 },
  footer: { marginTop: 16 },
});
