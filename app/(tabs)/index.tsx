import { useCallback, useEffect, useRef, useState } from "react";
import { useFocusEffect, useRouter } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSQLiteContext } from "expo-sqlite";
import {
  listFeeSettings,
  listMembers,
  listMonths,
  listPayments,
  listPracticeDaysForMonth,
  type Member,
  type PaymentWithMember,
} from "@/lib/db";
import { standardFeeAt } from "@/lib/balance";
import { currentMonthIso, formatMonthLabel, formatShortDate, formatYen, shiftMonth, todayIso } from "@/lib/format";
import { colors } from "@/lib/theme";
import { EmptyState, Screen, ScreenTitle } from "@/components/ui";
import { AppCard } from "@/components/AppCard";
import { AppButton } from "@/components/AppButton";
import { DoodleIcon } from "@/components/DoodleIcon";

const MEMBER_COL_WIDTH = 112;
const DATE_COL_WIDTH = 88;
const TOTAL_COL_WIDTH = 96;

export default function DashboardScreen() {
  const db = useSQLiteContext();
  const router = useRouter();

  const [selectedMonth, setSelectedMonth] = useState(currentMonthIso());
  const [members, setMembers] = useState<Member[]>([]);
  const [payments, setPayments] = useState<PaymentWithMember[]>([]);
  const [dateKeys, setDateKeys] = useState<string[]>([]);
  const [monthlyFee, setMonthlyFee] = useState(0);
  const [loaded, setLoaded] = useState(false);

  const didInit = useRef(false);
  useEffect(() => {
    if (didInit.current) return;
    didInit.current = true;
    listMonths(db).then((months) => {
      if (months.length > 0) {
        setSelectedMonth(months[0].month);
      }
    });
  }, [db]);

  const load = useCallback(
    (month: string) => {
      let cancelled = false;
      Promise.all([
        listMembers(db),
        listPayments(db),
        listPracticeDaysForMonth(db, month),
        listFeeSettings(db),
      ]).then(([m, allPayments, practiceDays, feeSettings]) => {
        if (cancelled) return;
        const monthPayments = allPayments.filter((p) => p.date.slice(0, 7) === month);
        const dates = Array.from(
          new Set([
            ...practiceDays.map((d) => d.date),
            ...monthPayments.map((p) => p.date),
          ]),
        ).sort((a, b) => a.localeCompare(b));
        setMembers(m);
        setPayments(monthPayments);
        setDateKeys(dates);
        setMonthlyFee(standardFeeAt(`${month}-01`, feeSettings));
        setLoaded(true);
      });
      return () => {
        cancelled = true;
      };
    },
    [db],
  );

  useFocusEffect(useCallback(() => load(selectedMonth), [load, selectedMonth]));

  const practiceDayCount = dateKeys.length;
  const totalCollected = payments.reduce((sum, p) => sum + p.amount, 0);

  const cellMap = new Map<string, PaymentWithMember[]>();
  for (const p of payments) {
    const key = `${p.memberId}__${p.date}`;
    const list = cellMap.get(key) ?? [];
    list.push(p);
    cellMap.set(key, list);
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.wrap} showsVerticalScrollIndicator={false}>
        <ScreenTitle
          title="会計表"
          subtitle="月ごとに、練習日×メンバーの支払い状況を確認できます。"
        />

        <AppCard style={styles.summaryCard}>
          <View style={styles.monthNav}>
            <Pressable
              testID="accounting-month-prev"
              style={styles.monthNavButton}
              onPress={() => setSelectedMonth((m) => shiftMonth(m, -1))}
              hitSlop={8}
            >
              <Text style={styles.monthNavButtonText}>◀</Text>
            </Pressable>
            <Text style={styles.monthLabel}>{formatMonthLabel(selectedMonth)}</Text>
            <Pressable
              testID="accounting-month-next"
              style={styles.monthNavButton}
              onPress={() => setSelectedMonth((m) => shiftMonth(m, 1))}
              hitSlop={8}
            >
              <Text style={styles.monthNavButtonText}>▶</Text>
            </Pressable>
          </View>
          <Text style={styles.summaryText}>
            練習日 {practiceDayCount}日 ・ 集金 {formatYen(totalCollected)}
          </Text>
          <Pressable
            testID="fee-history-link"
            style={styles.feeLink}
            onPress={() => router.push("/fee-history")}
            hitSlop={8}
          >
            <Text style={styles.feeText}>月謝額 {formatYen(monthlyFee)}</Text>
            <Text style={styles.feeLinkChevron}>›</Text>
          </Pressable>
        </AppCard>

        <View style={styles.attendanceButtonWrap}>
          <AppButton
            testID="attendance-today-button"
            title="✓ 今日の出欠を取る"
            variant="green"
            onPress={() => router.push(`/attendance/${todayIso()}`)}
          />
        </View>

        {loaded && members.length === 0 ? (
          <EmptyState>まだメンバーが登録されていません。「入力」タブから記録してください。</EmptyState>
        ) : loaded && dateKeys.length === 0 ? (
          <EmptyState>
            この月の練習日が登録されていません。「設定」タブで登録するか、支払いを記録してください。
          </EmptyState>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.table}>
              <View style={styles.headRow}>
                <View style={[styles.cell, styles.memberCol, styles.headCell]}>
                  <Text style={styles.headText}>メンバー</Text>
                </View>
                {dateKeys.map((d) => (
                  <Pressable
                    key={d}
                    testID={`accounting-date-header-${d}`}
                    style={[styles.cell, styles.dateCol, styles.headCell]}
                    onPress={() => router.push(`/attendance/${d}`)}
                  >
                    <Text style={styles.headTextLink}>{formatShortDate(d)}</Text>
                  </Pressable>
                ))}
                <View style={[styles.cell, styles.totalCol, styles.headCell]}>
                  <Text style={styles.headText}>合計</Text>
                </View>
              </View>
              {members.map((m) => {
                const memberTotal = payments
                  .filter((p) => p.memberId === m.id)
                  .reduce((sum, p) => sum + p.amount, 0);
                return (
                <View key={m.id} style={styles.row}>
                  <View style={[styles.cell, styles.memberCol]}>
                    <Text
                      style={styles.nameCell}
                      numberOfLines={1}
                      onPress={() => router.push(`/members/${m.id}`)}
                    >
                      {m.name}
                    </Text>
                  </View>
                  {dateKeys.map((d) => {
                    const cell = cellMap.get(`${m.id}__${d}`) ?? [];
                    return (
                      <View key={d} style={[styles.cell, styles.dateCol]}>
                        {cell.length === 0 ? (
                          <Text style={styles.dash}>-</Text>
                        ) : (
                          cell.map((p) => (
                            <View
                              key={p.id}
                              style={[
                                styles.amountPill,
                                {
                                  backgroundColor:
                                    p.type === "MONTHLY"
                                      ? colors.monthlyBg
                                      : colors.visitorBg,
                                },
                              ]}
                            >
                              <DoodleIcon
                                name={p.type === "MONTHLY" ? "leaf" : "flower"}
                                size={11}
                                color={
                                  p.type === "MONTHLY"
                                    ? colors.monthlyText
                                    : colors.visitorText
                                }
                              />
                              <Text
                                style={[
                                  styles.amountPillText,
                                  {
                                    color:
                                      p.type === "MONTHLY"
                                        ? colors.monthlyText
                                        : colors.visitorText,
                                  },
                                ]}
                              >
                                {formatYen(p.amount)}
                              </Text>
                            </View>
                          ))
                        )}
                      </View>
                    );
                  })}
                  <View style={[styles.cell, styles.totalCol]}>
                    <Text style={styles.totalCell}>{formatYen(memberTotal)}</Text>
                  </View>
                </View>
                );
              })}
            </View>
          </ScrollView>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 20, paddingBottom: 48 },
  summaryCard: { marginTop: 4, marginBottom: 18, gap: 10 },
  monthNav: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 18,
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
  monthLabel: { fontSize: 22, fontWeight: "800", color: colors.text, minWidth: 120, textAlign: "center" },
  summaryText: { textAlign: "center", color: colors.textMuted, fontSize: 15 },
  feeLink: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
    minHeight: 32,
  },
  feeText: { color: colors.green, fontSize: 14, fontWeight: "700" },
  feeLinkChevron: { color: colors.green, fontSize: 16, fontWeight: "700" },
  attendanceButtonWrap: { marginBottom: 18 },
  table: { borderWidth: 1, borderColor: colors.border, borderRadius: 16, overflow: "hidden" },
  headRow: { flexDirection: "row", backgroundColor: colors.tableHeadBg },
  row: { flexDirection: "row", borderTopWidth: 1, borderTopColor: colors.border },
  cell: {
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderLeftWidth: 1,
    borderLeftColor: colors.border,
    justifyContent: "center",
    gap: 4,
    minHeight: 52,
  },
  headCell: { borderLeftWidth: 0 },
  memberCol: { width: MEMBER_COL_WIDTH, borderLeftWidth: 0 },
  dateCol: { width: DATE_COL_WIDTH },
  totalCol: { width: TOTAL_COL_WIDTH, backgroundColor: colors.greenLight },
  headText: { fontWeight: "700", color: colors.textMuted, fontSize: 12 },
  headTextLink: { fontWeight: "700", color: colors.green, fontSize: 12, textDecorationLine: "underline" },
  nameCell: { fontWeight: "700", color: colors.text, fontSize: 13 },
  totalCell: { fontWeight: "800", color: colors.monthlyText, fontSize: 13 },
  dash: { color: colors.disabled, fontSize: 14 },
  amountPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    alignSelf: "flex-start",
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  amountPillText: { fontSize: 10.5, fontWeight: "700" },
});
