import { useCallback, useEffect, useRef, useState } from "react";
import { useFocusEffect, useRouter } from "expo-router";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSQLiteContext } from "expo-sqlite";
import {
  approveMonth,
  getFeeForMonth,
  isMonthApproved,
  listAttendance,
  listMemberMonthStatusForMonth,
  listMembers,
  listMonths,
  listPayments,
  listPracticeDaysForMonth,
  setMemberMonthStatus,
  type Attendance,
  type Member,
  type PaymentType,
  type PaymentWithMember,
} from "@/lib/db";
import { currentMonthIso, formatMonthLabel, formatShortDate, formatYen, shiftMonth, todayIso } from "@/lib/format";
import { colors } from "@/lib/theme";
import { EmptyState, Screen, ScreenTitle } from "@/components/ui";
import { AppCard } from "@/components/AppCard";
import { AppButton } from "@/components/AppButton";
import { DoodleIcon } from "@/components/DoodleIcon";

const MEMBER_COL_WIDTH = 120;
const DATE_COL_WIDTH = 88;
const TOTAL_COL_WIDTH = 96;

export default function DashboardScreen() {
  const db = useSQLiteContext();
  const router = useRouter();

  const [selectedMonth, setSelectedMonth] = useState(currentMonthIso());
  const [members, setMembers] = useState<Member[]>([]);
  const [payments, setPayments] = useState<PaymentWithMember[]>([]);
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [memberStatus, setMemberStatus] = useState<Record<string, PaymentType>>({});
  const [dateKeys, setDateKeys] = useState<string[]>([]);
  const [monthlyFee, setMonthlyFee] = useState(0);
  const [approved, setApproved] = useState(false);
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
        listAttendance(db),
        listPracticeDaysForMonth(db, month),
        listMemberMonthStatusForMonth(db, month),
        getFeeForMonth(db, month),
        isMonthApproved(db, month),
      ]).then(([m, allPayments, allAttendance, practiceDays, statusMap, fee, monthApproved]) => {
        if (cancelled) return;
        // 不足金支払いは日付が空欄(特定の練習日に紐づかない)なので、
        // 支払った月(createdAt)をその月の集金として扱う。
        const monthPayments = allPayments.filter(
          (p) => (p.date || p.createdAt).slice(0, 7) === month,
        );
        const monthAttendance = allAttendance.filter((a) => a.date.slice(0, 7) === month);
        const dates = practiceDays.map((d) => d.date).sort((a, b) => a.localeCompare(b));
        setMembers(m);
        setPayments(monthPayments);
        setAttendance(monthAttendance);
        setMemberStatus(statusMap);
        setDateKeys(dates);
        setMonthlyFee(fee);
        setApproved(monthApproved);
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
  const today = todayIso();

  const cellMap = new Map<string, PaymentWithMember[]>();
  for (const p of payments) {
    const key = `${p.memberId}__${p.date}`;
    const list = cellMap.get(key) ?? [];
    list.push(p);
    cellMap.set(key, list);
  }

  const attendanceMap = new Map<string, Attendance>();
  for (const a of attendance) {
    attendanceMap.set(`${a.memberId}__${a.date}`, a);
  }

  const memberRows = members.map((m) => {
    const memberTotal = payments
      .filter((p) => p.memberId === m.id)
      .reduce((sum, p) => sum + p.amount, 0);
    const status = memberStatus[m.id] ?? "MONTHLY";
    const isVisitor = status === "VISITOR";
    const monthlyPaidTotal = payments
      .filter((p) => p.memberId === m.id && p.type === "MONTHLY")
      .reduce((sum, p) => sum + p.amount, 0);
    const showMonthlyUnpaid = !isVisitor && monthlyPaidTotal < monthlyFee;
    const hasUnpaidVisitorDate =
      isVisitor &&
      dateKeys.some((d) => {
        const key = `${m.id}__${d}`;
        if (!attendanceMap.get(key)) return false;
        const cellPayments = cellMap.get(key) ?? [];
        return !cellPayments.some((p) => p.type === "VISITOR");
      });
    return { member: m, memberTotal, isVisitor, showMonthlyUnpaid, hasUnpaidVisitorDate };
  });

  const allMembersPaid =
    loaded &&
    memberRows.length > 0 &&
    dateKeys.length > 0 &&
    memberRows.every((r) => !r.showMonthlyUnpaid && !r.hasUnpaidVisitorDate);

  async function applyStatusChange(memberId: string, next: PaymentType) {
    setMemberStatus((prev) => ({ ...prev, [memberId]: next }));
    await setMemberMonthStatus(db, { memberId, month: selectedMonth, type: next });
  }

  function handleApproveMonth() {
    Alert.alert(
      "この月を承認しますか？",
      "承認すると、この月の支払い・出欠・区分・月謝設定は変更できなくなります。この操作は取り消せません。",
      [
        { text: "キャンセル", style: "cancel" },
        {
          text: "承認する",
          onPress: async () => {
            await approveMonth(db, selectedMonth);
            setApproved(true);
          },
        },
      ],
    );
  }

  function handleToggleStatus(memberId: string) {
    if (approved) {
      Alert.alert("変更できません", "承認済みの月は区分を変更できません。");
      return;
    }
    const alreadySet = memberStatus[memberId] !== undefined;
    const current = memberStatus[memberId] ?? "MONTHLY";
    const next: PaymentType = current === "MONTHLY" ? "VISITOR" : "MONTHLY";
    const currentLabel = current === "MONTHLY" ? "月謝" : "ビジター";
    const nextLabel = next === "MONTHLY" ? "月謝" : "ビジター";

    // 現在の区分での支払い記録が今月すでにある場合は、区分の不整合を防ぐため
    // まずその支払いを削除してもらう必要がある。
    const existingPaymentsForCurrentType = payments.filter(
      (p) => p.memberId === memberId && p.type === current,
    );
    if (existingPaymentsForCurrentType.length > 0) {
      Alert.alert(
        "区分を変更できません",
        `この月はすでに${currentLabel}として支払いが記録されています（${existingPaymentsForCurrentType.length}件）。区分を変更するには、先にメンバー詳細からその支払い記録を削除してください。`,
      );
      return;
    }

    // 初回(まだ明示的に設定されていない場合)はそのまま設定するが、
    // 一度設定した後の変更は誤操作防止のため確認ダイアログを挟む。
    if (!alreadySet) {
      applyStatusChange(memberId, next);
      return;
    }

    Alert.alert(
      "区分を変更しますか？",
      `${currentLabel}から${nextLabel}に変更します。`,
      [
        { text: "キャンセル", style: "cancel" },
        {
          text: "変更する",
          onPress: () => applyStatusChange(memberId, next),
        },
      ],
    );
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
          <Text style={styles.feeText}>月謝額 {formatYen(monthlyFee)}</Text>
          {approved ? (
            <View testID="month-approved-badge" style={styles.approvedBadge}>
              <Text style={styles.approvedBadgeText}>承認済み・ロック中</Text>
            </View>
          ) : null}
        </AppCard>

        <View style={styles.attendanceButtonWrap}>
          <AppButton
            testID="change-fee-button"
            title="月謝を変更する"
            variant="green"
            onPress={() => router.push(`/fee-history/${selectedMonth}`)}
            disabled={approved}
          />
        </View>

        {loaded && !approved && allMembersPaid ? (
          <View style={styles.attendanceButtonWrap}>
            <AppButton
              testID="approve-month-button"
              title="この月を承認する"
              onPress={handleApproveMonth}
            />
          </View>
        ) : null}

        {loaded && members.length === 0 ? (
          <EmptyState>まだメンバーが登録されていません。「入力」タブから記録してください。</EmptyState>
        ) : loaded && dateKeys.length === 0 ? (
          <EmptyState>
            この月の練習日が登録されていません。「設定」タブで登録してください。
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
                    onPress={() => router.push({ pathname: "/attendance", params: { date: d } })}
                  >
                    <Text style={styles.headTextLink}>{formatShortDate(d)}</Text>
                  </Pressable>
                ))}
                <View style={[styles.cell, styles.totalCol, styles.headCell]}>
                  <Text style={styles.headText}>合計</Text>
                </View>
              </View>
              {memberRows.map(({ member: m, memberTotal, isVisitor, showMonthlyUnpaid, hasUnpaidVisitorDate }) => {
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
                    <Pressable
                      testID={`member-status-toggle-${m.id}`}
                      style={[styles.statusChip, isVisitor && styles.statusChipVisitor]}
                      onPress={() => handleToggleStatus(m.id)}
                      disabled={approved}
                      hitSlop={4}
                    >
                      <Text
                        style={[
                          styles.statusChipText,
                          isVisitor && styles.statusChipTextVisitor,
                        ]}
                      >
                        {isVisitor ? "ビジター" : "月謝"}
                      </Text>
                    </Pressable>
                  </View>
                  {dateKeys.map((d) => {
                    const key = `${m.id}__${d}`;
                    const att = attendanceMap.get(key);
                    const cellPayments = cellMap.get(key) ?? [];
                    const matchingVisitorPayment = isVisitor
                      ? cellPayments.find((p) => p.type === "VISITOR")
                      : undefined;
                    const extraPayments = cellPayments.filter(
                      (p) => p.id !== matchingVisitorPayment?.id,
                    );
                    const showUnpaidVisitor = !!att && isVisitor && !matchingVisitorPayment;
                    const showAttended = !!att;
                    const isEmpty =
                      !att && extraPayments.length === 0 && !matchingVisitorPayment;
                    const isPastOrToday = d <= today;

                    return (
                      <View key={d} style={[styles.cell, styles.dateCol]}>
                        {isEmpty ? (
                          isPastOrToday ? (
                            <View style={[styles.amountPill, styles.absentPill]}>
                              <Text style={[styles.amountPillText, styles.absentPillText]}>
                                欠席
                              </Text>
                            </View>
                          ) : (
                            <Text style={styles.dash}>-</Text>
                          )
                        ) : (
                          <>
                            {showAttended ? (
                              <View style={[styles.amountPill, { backgroundColor: colors.monthlyBg }]}>
                                <DoodleIcon name="leaf" size={11} color={colors.monthlyText} />
                                <Text style={[styles.amountPillText, { color: colors.monthlyText }]}>
                                  出席
                                </Text>
                              </View>
                            ) : null}
                            {showUnpaidVisitor ? (
                              <View style={[styles.amountPill, { backgroundColor: colors.unpaidBg }]}>
                                <DoodleIcon name="flower" size={11} color={colors.unpaidText} />
                                <Text style={[styles.amountPillText, { color: colors.unpaidText }]}>
                                  未払い
                                </Text>
                              </View>
                            ) : null}
                            {matchingVisitorPayment ? (
                              <View style={[styles.amountPill, { backgroundColor: colors.visitorBg }]}>
                                <DoodleIcon name="flower" size={11} color={colors.visitorText} />
                                <Text style={[styles.amountPillText, { color: colors.visitorText }]}>
                                  {formatYen(matchingVisitorPayment.amount)}
                                </Text>
                              </View>
                            ) : null}
                            {extraPayments.map((p) => (
                              <View
                                key={p.id}
                                style={[
                                  styles.amountPill,
                                  {
                                    backgroundColor:
                                      p.type === "MONTHLY" ? colors.monthlyBg : colors.visitorBg,
                                  },
                                ]}
                              >
                                <DoodleIcon
                                  name={p.type === "MONTHLY" ? "leaf" : "flower"}
                                  size={11}
                                  color={p.type === "MONTHLY" ? colors.monthlyText : colors.visitorText}
                                />
                                <Text
                                  style={[
                                    styles.amountPillText,
                                    {
                                      color:
                                        p.type === "MONTHLY" ? colors.monthlyText : colors.visitorText,
                                    },
                                  ]}
                                >
                                  {formatYen(p.amount)}
                                </Text>
                              </View>
                            ))}
                          </>
                        )}
                      </View>
                    );
                  })}
                  <View style={[styles.cell, styles.totalCol]}>
                    <Text style={styles.totalCell}>{formatYen(memberTotal)}</Text>
                    {showMonthlyUnpaid || hasUnpaidVisitorDate ? (
                      <View style={[styles.amountPill, styles.unpaidPill]}>
                        <Text style={[styles.amountPillText, styles.unpaidPillText]}>未払い</Text>
                      </View>
                    ) : null}
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
  feeText: { textAlign: "center", color: colors.green, fontSize: 14, fontWeight: "700" },
  approvedBadge: {
    alignSelf: "center",
    backgroundColor: colors.tableHeadBg,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 5,
    marginTop: 2,
  },
  approvedBadgeText: { fontSize: 12, fontWeight: "700", color: colors.textMuted },
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
  memberCol: { width: MEMBER_COL_WIDTH, borderLeftWidth: 0, gap: 6 },
  dateCol: { width: DATE_COL_WIDTH },
  totalCol: { width: TOTAL_COL_WIDTH, backgroundColor: colors.greenLight },
  headText: { fontWeight: "700", color: colors.textMuted, fontSize: 12 },
  headTextLink: { fontWeight: "700", color: colors.green, fontSize: 12, textDecorationLine: "underline" },
  nameCell: { fontWeight: "700", color: colors.text, fontSize: 13 },
  totalCell: { fontWeight: "800", color: colors.monthlyText, fontSize: 13 },
  dash: { color: colors.disabled, fontSize: 14 },
  statusChip: {
    alignSelf: "flex-start",
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: colors.monthlyBg,
  },
  statusChipVisitor: { backgroundColor: colors.visitorBg },
  statusChipText: { fontSize: 10.5, fontWeight: "700", color: colors.monthlyText },
  statusChipTextVisitor: { color: colors.visitorText },
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
  absentPill: { backgroundColor: colors.tableHeadBg },
  absentPillText: { color: colors.textMuted },
  unpaidPill: { backgroundColor: colors.unpaidBg, alignSelf: "center" },
  unpaidPillText: { color: colors.unpaidText },
});
