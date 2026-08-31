import { useCallback, useEffect, useRef, useState } from "react";
import { useFocusEffect } from "expo-router";
import { Alert, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSQLiteContext } from "expo-sqlite";
import {
  createPaymentForMember,
  getFeeForMonth,
  getFeeForMonths,
  getMemberMonthStatus,
  listAttendanceForMember,
  listMembers,
  listMemberMonthStatusForMember,
  listPaymentsForMember,
  listPracticeDays,
  MonthLockedError,
  VISITOR_FEE,
  type Member,
  type PaymentType,
  type PracticeDay,
} from "@/lib/db";
import { computeBalance, excludeCancelledPayments } from "@/lib/balance";
import { currentMonthIso, formatDate, formatMonthLabel, formatYen, shiftMonth, todayIso } from "@/lib/format";
import { colors } from "@/lib/theme";
import { Screen } from "@/components/ui";
import { AppCard } from "@/components/AppCard";
import { AppButton } from "@/components/AppButton";
import { MemberSelectField } from "@/components/MemberSelectField";
import { PaymentFields } from "@/components/PaymentFields";

const PRACTICE_DAY_HISTORY_MONTHS = 12;

function selectableDates(days: PracticeDay[]): PracticeDay[] {
  const cutoff = `${shiftMonth(currentMonthIso(), -(PRACTICE_DAY_HISTORY_MONTHS - 1))}-01`;
  return days
    .filter((d) => d.date >= cutoff)
    .sort((a, b) => b.date.localeCompare(a.date));
}

function pickDefaultDate(days: PracticeDay[]): string {
  const today = todayIso();
  if (days.some((d) => d.date === today)) return today;
  const past = days.filter((d) => d.date <= today);
  if (past.length > 0) return past[0].date; // days are sorted desc, so first past entry is the most recent
  const future = [...days].sort((a, b) => a.date.localeCompare(b.date));
  return future.length > 0 ? future[0].date : "";
}

export default function EntryScreen() {
  const db = useSQLiteContext();

  const [date, setDate] = useState("");
  const [memberId, setMemberId] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [type, setType] = useState<PaymentType>("MONTHLY");
  const [isShortfallMode, setIsShortfallMode] = useState(false);
  const [members, setMembers] = useState<Member[]>([]);
  const [practiceDays, setPracticeDays] = useState<PracticeDay[]>([]);
  const [selectableDatesForMember, setSelectableDatesForMember] = useState<PracticeDay[]>([]);
  const [currentFee, setCurrentFee] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const didInit = useRef(false);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      Promise.all([listMembers(db), listPracticeDays(db)]).then(([memberList, days]) => {
        if (cancelled) return;
        const selectable = selectableDates(days);
        setMembers(memberList);
        setPracticeDays(selectable);
        if (!didInit.current) {
          didInit.current = true;
          setDate(pickDefaultDate(selectable));
        }
      });
      return () => {
        cancelled = true;
      };
    }, [db]),
  );

  // メンバーを選択したら、そのメンバーがまだ支払っていない練習日だけに日付の候補を絞り込む。
  // (月謝はその月の月謝が未払いの月に含まれる日、ビジターは出席済みで未払いの日)
  // ビジター代未払いの日は、その後に練習日設定から削除されていても必ず候補に含める
  // (そうしないと未払いを解消する手段がなくなってしまうため)。
  useEffect(() => {
    if (!memberId) {
      setSelectableDatesForMember(practiceDays);
      return;
    }
    let cancelled = false;
    Promise.all([
      listAttendanceForMember(db, memberId),
      listPaymentsForMember(db, memberId),
      listMemberMonthStatusForMember(db, memberId),
    ]).then(async ([memberAttendance, rawMemberPayments, statusByMonth]) => {
      if (cancelled) return;
      // 取消済みの支払いとその取消履歴自体は、未払い判定からは除外する
      // (削除された場合と同じ扱いにする)。
      const memberPayments = excludeCancelledPayments(rawMemberPayments);
      const months = Array.from(
        new Set([
          ...practiceDays.map((d) => d.date.slice(0, 7)),
          ...memberAttendance.map((a) => a.date.slice(0, 7)),
        ]),
      );
      const fees = await getFeeForMonths(db, months);
      if (cancelled) return;
      const visitorPaidDates = new Set(
        memberPayments.filter((p) => p.type === "VISITOR").map((p) => p.date),
      );
      const monthlyPaidByMonth: Record<string, number> = {};
      for (const p of memberPayments) {
        if (p.type !== "MONTHLY") continue;
        const month = p.date.slice(0, 7);
        monthlyPaidByMonth[month] = (monthlyPaidByMonth[month] ?? 0) + p.amount;
      }
      const statusForDate = (d: string): PaymentType => statusByMonth[d.slice(0, 7)] ?? "MONTHLY";

      const unpaidVisitorDates = memberAttendance
        .filter((a) => statusForDate(a.date) === "VISITOR" && !visitorPaidDates.has(a.date))
        .map((a) => a.date);
      const unpaidMonthlyDates = practiceDays
        .filter((d) => {
          if (statusForDate(d.date) !== "MONTHLY") return false;
          const month = d.date.slice(0, 7);
          return (monthlyPaidByMonth[month] ?? 0) < (fees[month] ?? 0);
        })
        .map((d) => d.date);

      const eligibleDateStrings = Array.from(
        new Set([...unpaidVisitorDates, ...unpaidMonthlyDates]),
      ).sort((a, b) => b.localeCompare(a));
      const eligible: PracticeDay[] = eligibleDateStrings.map(
        (d) => practiceDays.find((p) => p.date === d) ?? { id: d, date: d, createdAt: "" },
      );

      setSelectableDatesForMember(eligible);
      const nextDate = eligible.some((d) => d.date === date) ? date : pickDefaultDate(eligible);
      setDate(nextDate);
      setIsShortfallMode(false);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db, memberId, practiceDays]);

  // 区分(月謝/ビジター)は名前と日付の組み合わせから、会計表と同じ
  // member_month_status(その月の区分設定)を参照して常に取得し直す。
  // 日付ドロップダウンで別の日付(=別の月)を選び直した場合も追従する。
  useEffect(() => {
    if (!memberId || !date) {
      setType("MONTHLY");
      return;
    }
    let cancelled = false;
    getMemberMonthStatus(db, memberId, date.slice(0, 7)).then((status) => {
      if (cancelled) return;
      setType(status);
      if (status !== "MONTHLY") {
        setIsShortfallMode(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [db, memberId, date]);

  // もらう金額は基本選択できない: 月謝ならその月の月謝額、ビジターなら固定1,000円。
  // 「不足金支払い」を選んでいる間だけ、金額を自由入力できる。
  useEffect(() => {
    if (!date) return;
    let cancelled = false;
    getFeeForMonth(db, date.slice(0, 7)).then((fee) => {
      if (cancelled) return;
      setCurrentFee(fee);
      if (!isShortfallMode) {
        setAmount(type === "MONTHLY" ? String(fee) : String(VISITOR_FEE));
      }
    });
    return () => {
      cancelled = true;
    };
  }, [db, date, type, isShortfallMode]);

  function handleSelectFullAmount() {
    setIsShortfallMode(false);
  }

  async function handleSelectShortfall() {
    // 不足金支払いは特定の練習日に紐づかない(日付は空欄で登録する)ため、
    // 初期金額はこれまでの月謝の不足分(繰越の未払金 + まだ一切支払いのない
    // 月の月謝額)をまとめて相殺できる金額をデフォルトにする。
    // balanceは実際に記録された支払いの差額しか見ないため、対象月に一切
    // 支払いがない場合は、その月の月謝額を別途差し引いて不足分に含める。
    const month = date ? date.slice(0, 7) : currentMonthIso();
    const memberPayments = excludeCancelledPayments(await listPaymentsForMember(db, memberId));
    const monthlyPayments = memberPayments.filter((p) => p.type === "MONTHLY");
    const months = Array.from(
      new Set([...monthlyPayments.map((p) => p.date.slice(0, 7)).filter(Boolean), month]),
    );
    const fees = await getFeeForMonths(db, months);
    const balance = computeBalance(monthlyPayments, (m) => fees[m] ?? 0);
    const paidThisMonth = monthlyPayments
      .filter((p) => p.date.slice(0, 7) === month)
      .reduce((sum, p) => sum + p.amount, 0);
    const effectiveBalance =
      paidThisMonth === 0 ? balance - (fees[month] ?? currentFee) : balance;
    setAmount(String(Math.max(0, -effectiveBalance)));
    setIsShortfallMode(true);
  }

  const showShortfallOption = !!memberId && type === "MONTHLY";
  const canSubmit =
    memberId.length > 0 && amount.length > 0 && (isShortfallMode || date.length === 10);

  async function handleSubmit() {
    const amountNum = Number(amount);
    if (!Number.isFinite(amountNum) || amountNum < 0) {
      Alert.alert("金額が正しくありません");
      return;
    }
    if (!memberId) {
      Alert.alert("メンバーを選択してください");
      return;
    }
    // 不足金支払いは特定の練習日に紐づかないため、日付は空欄で登録する。
    const paymentDate = isShortfallMode ? "" : date;
    setSubmitting(true);
    try {
      const existing = excludeCancelledPayments(await listPaymentsForMember(db, memberId));
      if (paymentDate && existing.some((p) => p.date === paymentDate)) {
        Alert.alert(
          "支払い済みです",
          `${formatDate(paymentDate)}はすでにこのメンバーの支払いが記録されています。`,
        );
        return;
      }
      if (!isShortfallMode) {
        const monthStatus = await getMemberMonthStatus(db, memberId, paymentDate.slice(0, 7));
        if (monthStatus !== type) {
          const memberName = members.find((m) => m.id === memberId)?.name ?? "";
          const statusLabel = monthStatus === "MONTHLY" ? "月謝" : "ビジター";
          const typeLabel = type === "MONTHLY" ? "月謝" : "ビジター";
          Alert.alert(
            "区分が一致しません",
            `${memberName}さんは今月「${statusLabel}」として設定されています。「${typeLabel}」として登録することはできません。会計表の名前横で区分を変更してから登録してください。`,
          );
          return;
        }
      }
      try {
        await createPaymentForMember(db, {
          memberId,
          date: paymentDate,
          amount: amountNum,
          type,
          note,
        });
      } catch (err) {
        if (err instanceof MonthLockedError) {
          Alert.alert(
            "登録できません",
            `${formatMonthLabel(err.month)}は承認済みのため、支払いを登録できません。`,
          );
          return;
        }
        throw err;
      }
      const memberName = members.find((m) => m.id === memberId)?.name ?? "";
      setFeedback(`✓ ${memberName}さんの支払い（${formatYen(amountNum)}）を登録しました`);
      setMemberId("");
      setType("MONTHLY");
      setIsShortfallMode(false);
      setNote("");
    } finally {
      setSubmitting(false);
    }
  }

  function handleMemberChange(id: string) {
    setMemberId(id);
    setFeedback(null);
    setIsShortfallMode(false);
    setNote("");
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.wrap} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={styles.titleBlock}>
          <Text style={styles.title}>支払いを記録</Text>
          <Text style={styles.priceLine}>
            現在の月謝額：<Text style={styles.priceValue}>{formatYen(currentFee)}</Text>
          </Text>
        </View>
        <AppCard style={styles.form}>
          <MemberSelectField
            testID="entry-member-select"
            label="メンバーの名前"
            value={memberId}
            onChange={handleMemberChange}
            members={members}
          />
          <PaymentFields
            date={date}
            onDateChange={setDate}
            practiceDays={memberId ? selectableDatesForMember : practiceDays}
            dateEmptyTitle={memberId ? "未払いの練習日はありません" : undefined}
            dateEmptyHint={memberId ? "このメンバーの支払いはすべて完了しています。" : undefined}
            amount={amount}
            amountEditable={isShortfallMode}
            onAmountChange={setAmount}
            type={type}
            showShortfallOption={showShortfallOption}
            isShortfallMode={isShortfallMode}
            onSelectFullAmount={handleSelectFullAmount}
            onSelectShortfall={handleSelectShortfall}
            note={note}
            onNoteChange={setNote}
            testIDs={{
              date: "entry-date",
              amount: "entry-amount",
              typeFull: "entry-type-full",
              typeShortfall: "entry-type-shortfall",
              note: "entry-note",
            }}
          />
          <AppButton
            testID="entry-submit"
            title={submitting ? "登録中..." : "登録する"}
            onPress={handleSubmit}
            disabled={!canSubmit || submitting}
          />
          {feedback ? (
            <Text testID="entry-feedback" style={styles.feedbackText}>
              {feedback}
            </Text>
          ) : null}
        </AppCard>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 20, paddingBottom: 48 },
  titleBlock: { marginBottom: 20, gap: 6 },
  title: { fontSize: 25, fontWeight: "800", color: colors.text },
  priceLine: { fontSize: 15, color: colors.textMuted },
  priceValue: { color: colors.green, fontWeight: "700" },
  form: { gap: 20 },
  feedbackText: {
    textAlign: "center",
    color: colors.green,
    fontWeight: "700",
    fontSize: 14,
  },
});
