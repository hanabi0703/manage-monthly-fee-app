import { useCallback, useState } from "react";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useSQLiteContext } from "expo-sqlite";
import {
  cancelPayment,
  getFeeForMonths,
  getMember,
  listAttendanceForMember,
  listMemberMonthStatusForMember,
  listPaymentsForMember,
  MonthLockedError,
  VISITOR_FEE,
  type Member,
  type Payment,
  type PaymentType,
} from "@/lib/db";
import { computeBalance, excludeCancelledPayments } from "@/lib/balance";
import { currentMonthIso, formatDate, formatYen } from "@/lib/format";
import { colors } from "@/lib/theme";
import { Badge, EmptyState, Screen, SectionLabel } from "@/components/ui";
import { AppCard } from "@/components/AppCard";

export default function MemberDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const db = useSQLiteContext();
  const router = useRouter();
  const [member, setMember] = useState<Member | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [feeByMonth, setFeeByMonth] = useState<Record<string, number>>({});
  const [statusByMonth, setStatusByMonth] = useState<Record<string, PaymentType>>({});
  const [unpaidVisitorDates, setUnpaidVisitorDates] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(() => {
    if (!id) return () => {};
    let cancelled = false;
    const currentMonth = currentMonthIso();
    Promise.all([
      getMember(db, id),
      listPaymentsForMember(db, id),
      listAttendanceForMember(db, id),
      listMemberMonthStatusForMember(db, id),
    ]).then(async ([m, p, attendanceList, statusMap]) => {
      if (cancelled) return;
      const months = Array.from(
        new Set([...p.map((payment) => payment.date.slice(0, 7)), currentMonth]),
      );
      const fees = await getFeeForMonths(db, months);
      if (cancelled) return;
      // 取消済みの支払いは「支払っていない」扱いにする(削除時と同じ)。
      const effectiveForUnpaid = excludeCancelledPayments(p);
      const visitorPaidDates = new Set(
        effectiveForUnpaid
          .filter((payment) => payment.type === "VISITOR")
          .map((payment) => payment.date),
      );
      const unpaidVisitor = attendanceList
        .filter((a) => (statusMap[a.date.slice(0, 7)] ?? "MONTHLY") === "VISITOR")
        .filter((a) => !visitorPaidDates.has(a.date))
        .map((a) => a.date)
        .sort((a, b) => b.localeCompare(a));
      setMember(m);
      setPayments(p);
      setFeeByMonth(fees);
      setStatusByMonth(statusMap);
      setUnpaidVisitorDates(unpaidVisitor);
      setLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, [db, id]);

  useFocusEffect(load);

  async function handleCancel(paymentId: string) {
    try {
      await cancelPayment(db, paymentId);
    } catch (err) {
      if (err instanceof MonthLockedError) {
        Alert.alert("取消できません", "承認済みの月の支払いは取消できません。");
        return;
      }
      throw err;
    }
    load();
  }

  // 取消済みの支払いとその取消履歴自体は、残高・未払い判定からは除外する
  // (履歴一覧には両方とも表示したまま、削除された場合と同じ扱いにする)。
  const effectivePayments = excludeCancelledPayments(payments);
  const cancelledOriginalIds = new Set(
    payments.filter((p) => p.cancelsPaymentId).map((p) => p.cancelsPaymentId as string),
  );
  const monthlyPayments = effectivePayments.filter((p) => p.type === "MONTHLY");
  const balance = computeBalance(monthlyPayments, (month) => feeByMonth[month] ?? 0);

  const currentMonth = currentMonthIso();
  const currentMonthStatus = statusByMonth[currentMonth] ?? "MONTHLY";
  const currentMonthFee = feeByMonth[currentMonth] ?? 0;
  const paidThisMonth = monthlyPayments
    .filter((p) => p.date.slice(0, 7) === currentMonth)
    .reduce((sum, p) => sum + p.amount, 0);
  // balanceはcomputeBalance経由で実際の支払い記録から差額を計算するため、
  // 部分的な支払いがあればそこですでに不足分が反映される。今月一切払っていない
  // (記録が無い)場合のみ、ここでbalanceから月謝額を差し引いて未払いに含める
  // (加算ではなく減算にすることで、不足金支払いによる繰越credit分が
  // 正しく相殺され、二重計上にならない)。
  const currentMonthUnpaid = currentMonthStatus === "MONTHLY" && paidThisMonth === 0;
  const effectiveBalance = currentMonthUnpaid ? balance - currentMonthFee : balance;
  const hasUnpaidItems = effectiveBalance < 0 || unpaidVisitorDates.length > 0;
  const hasAnyUnpaid = hasUnpaidItems;
  const totalUnpaidAmount =
    Math.max(0, -effectiveBalance) + unpaidVisitorDates.length * VISITOR_FEE;

  if (loaded && !member) {
    return (
      <Screen>
        <View style={styles.wrap}>
          <EmptyState>メンバーが見つかりませんでした。</EmptyState>
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <FlatList
        contentContainerStyle={styles.wrap}
        data={payments}
        keyExtractor={(p) => p.id}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View style={styles.header}>
            <View style={styles.nameRow}>
              <Text style={styles.name}>{member?.name ?? ""}さんのページ</Text>
              {id ? (
                <Pressable
                  hitSlop={10}
                  onPress={() => router.push(`/members/${id}/edit`)}
                >
                  <Text style={styles.editLink}>編集</Text>
                </Pressable>
              ) : null}
            </View>
            <Text style={styles.subtitle}>
              支払い履歴と繰越金・未払金の状況です。
            </Text>
            <AppCard style={styles.balanceCard}>
              {hasAnyUnpaid ? (
                <>
                  <Text style={styles.balanceLabel}>未払い</Text>
                  <Text style={[styles.balanceValue, { color: colors.unpaidText }]}>
                    {formatYen(totalUnpaidAmount)}
                  </Text>
                  <Text style={styles.balanceNote}>
                    {effectiveBalance < 0
                      ? "月謝の支払いが標準額に対して不足しています。"
                      : "ビジター代の未払いがあります。"}
                  </Text>
                </>
              ) : effectiveBalance > 0 ? (
                <>
                  <Text style={styles.balanceLabel}>繰越金</Text>
                  <Text style={[styles.balanceValue, { color: colors.creditText }]}>
                    {formatYen(effectiveBalance)}
                  </Text>
                  <Text style={styles.balanceNote}>
                    月謝を標準額より多く払っているため、繰り越されています。
                  </Text>
                </>
              ) : (
                <>
                  <Text style={styles.balanceLabel}>未払金・繰越金</Text>
                  <Text style={styles.balanceValue}>なし（精算済み）</Text>
                </>
              )}
            </AppCard>

            {hasUnpaidItems ? (
              <AppCard style={styles.unpaidCard}>
                <Text style={styles.unpaidCardTitle}>未払いの内容</Text>
                {effectiveBalance < 0 ? (
                  <View style={styles.unpaidItemRow}>
                    <Text style={styles.unpaidItemLabel}>月謝の不足分</Text>
                    <Text style={styles.unpaidItemAmount}>
                      {formatYen(Math.abs(effectiveBalance))}
                    </Text>
                  </View>
                ) : null}
                {unpaidVisitorDates.map((d) => (
                  <View key={d} style={styles.unpaidItemRow}>
                    <Text style={styles.unpaidItemLabel}>{formatDate(d)}のビジター代</Text>
                    <Text style={styles.unpaidItemAmount}>{formatYen(VISITOR_FEE)}</Text>
                  </View>
                ))}
              </AppCard>
            ) : null}

            <View style={styles.historyHeader}>
              <SectionLabel>支払い履歴</SectionLabel>
            </View>
            {payments.length === 0 ? (
              <EmptyState>まだ支払い記録がありません。</EmptyState>
            ) : null}
          </View>
        }
        renderItem={({ item }) => {
          const isCancellation = !!item.cancelsPaymentId;
          const isCancelled = cancelledOriginalIds.has(item.id);
          const std =
            item.type === "MONTHLY" ? feeByMonth[item.date.slice(0, 7)] ?? null : null;
          const diff = std === null || isCancellation ? null : item.amount - std;
          const paidDate = item.createdAt.slice(0, 10);
          return (
            <AppCard style={[styles.paymentRow, isCancellation && styles.paymentRowCancelled]}>
              <View style={styles.paymentInfo}>
                <Text style={styles.paymentDate}>
                  {isCancellation
                    ? item.date
                      ? `取消（参加日: ${formatDate(item.date)}）`
                      : "取消（不足金支払い）"
                    : item.date
                      ? `参加日: ${formatDate(item.date)}`
                      : "不足金支払い"}
                </Text>
                <Text style={styles.paidDate}>
                  {isCancellation ? "取消日" : "支払日"}: {formatDate(paidDate)}
                </Text>
                <View style={styles.paymentMeta}>
                  {item.type === "MONTHLY" ? (
                    <Badge label="月謝" tone="monthly" />
                  ) : (
                    <Badge label="ビジター" tone="visitor" />
                  )}
                  <Text
                    style={[styles.paymentAmount, isCancellation && styles.paymentAmountCancelled]}
                  >
                    {formatYen(item.amount)}
                  </Text>
                  {diff !== null && diff !== 0 ? (
                    <Text
                      style={{
                        color: diff > 0 ? colors.creditText : colors.unpaidText,
                        fontSize: 12,
                      }}
                    >
                      {diff > 0 ? "+" : ""}
                      {formatYen(diff)}
                    </Text>
                  ) : null}
                  {isCancelled ? <Badge label="取消済み" tone="neutral" /> : null}
                </View>
                {item.note ? <Text style={styles.paymentNote}>{item.note}</Text> : null}
              </View>
              {!isCancellation && !isCancelled ? (
                <Pressable
                  testID={`payment-cancel-${item.id}`}
                  hitSlop={10}
                  onPress={() =>
                    Alert.alert("取消しますか？", "支払い記録は残したまま、取消の履歴が追加されます。", [
                      { text: "キャンセル", style: "cancel" },
                      {
                        text: "取消する",
                        style: "destructive",
                        onPress: () => handleCancel(item.id),
                      },
                    ])
                  }
                >
                  <Text style={styles.deleteText}>取消する</Text>
                </Pressable>
              ) : null}
            </AppCard>
          );
        }}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 20, paddingBottom: 48 },
  header: { gap: 14, marginBottom: 4 },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  name: { fontSize: 24, fontWeight: "800", color: colors.text },
  editLink: { fontSize: 14, color: colors.textMuted, textDecorationLine: "underline" },
  subtitle: { fontSize: 14, color: colors.textMuted },
  balanceCard: { gap: 4 },
  balanceLabel: { fontSize: 14, color: colors.textMuted },
  balanceValue: { fontSize: 26, fontWeight: "800", color: colors.text, marginTop: 6 },
  balanceNote: { fontSize: 12, color: colors.textMuted, marginTop: 6, lineHeight: 18 },
  unpaidCard: { gap: 8, backgroundColor: colors.unpaidBg, borderColor: colors.unpaidText },
  unpaidCardTitle: { fontSize: 13, fontWeight: "700", color: colors.unpaidText },
  unpaidItemRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  unpaidItemLabel: { fontSize: 14, color: colors.text },
  unpaidItemAmount: { fontSize: 14, fontWeight: "700", color: colors.unpaidText },
  historyHeader: { marginTop: 4 },
  paymentRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  paymentRowCancelled: { backgroundColor: colors.bg, opacity: 0.8 },
  paymentInfo: { gap: 6 },
  paymentDate: { fontSize: 14, fontWeight: "700", color: colors.text },
  paidDate: { fontSize: 12, color: colors.textMuted },
  paymentMeta: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 2 },
  paymentAmount: { fontSize: 13, color: colors.text },
  paymentAmountCancelled: { color: colors.unpaidText, fontWeight: "700" },
  paymentNote: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  deleteText: { fontSize: 13, color: colors.coral },
  separator: { height: 10 },
});
