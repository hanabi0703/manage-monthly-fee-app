import { useCallback, useEffect, useRef, useState } from "react";
import { useFocusEffect } from "expo-router";
import { Alert, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSQLiteContext } from "expo-sqlite";
import {
  createPaymentForMember,
  getFeeForMonth,
  getMemberMonthStatus,
  listMembers,
  listPaymentsForMember,
  listPracticeDays,
  type Member,
  type PaymentType,
  type PracticeDay,
} from "@/lib/db";
import { currentMonthIso, formatDate, formatYen, shiftMonth, todayIso } from "@/lib/format";
import { colors } from "@/lib/theme";
import { Screen } from "@/components/ui";
import { AppCard } from "@/components/AppCard";
import { AppButton } from "@/components/AppButton";
import { MemberSelectField } from "@/components/MemberSelectField";
import { PaymentFields } from "@/components/PaymentFields";

const PRACTICE_DAY_HISTORY_MONTHS = 12;
const VISITOR_FEE = 1000;

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
  const [type, setType] = useState<PaymentType>("MONTHLY");
  const [members, setMembers] = useState<Member[]>([]);
  const [practiceDays, setPracticeDays] = useState<PracticeDay[]>([]);
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

  // もらう金額は選択できない: 月謝ならその月の月謝額、ビジターなら固定1,000円。
  useEffect(() => {
    if (!date) return;
    let cancelled = false;
    getFeeForMonth(db, date.slice(0, 7)).then((fee) => {
      if (cancelled) return;
      setCurrentFee(fee);
      setAmount(type === "MONTHLY" ? String(fee) : String(VISITOR_FEE));
    });
    return () => {
      cancelled = true;
    };
  }, [db, date, type]);

  const canSubmit = date.length === 10 && memberId.length > 0 && amount.length > 0;

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
    setSubmitting(true);
    try {
      const existing = await listPaymentsForMember(db, memberId);
      if (existing.some((p) => p.date === date)) {
        Alert.alert(
          "支払い済みです",
          `${formatDate(date)}はすでにこのメンバーの支払いが記録されています。`,
        );
        return;
      }
      const monthStatus = await getMemberMonthStatus(db, memberId, date.slice(0, 7));
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
      await createPaymentForMember(db, { memberId, date, amount: amountNum, type });
      const memberName = members.find((m) => m.id === memberId)?.name ?? "";
      setFeedback(`✓ ${memberName}さんの支払い（${formatYen(amountNum)}）を登録しました`);
      setMemberId("");
      setType("MONTHLY");
    } finally {
      setSubmitting(false);
    }
  }

  function handleMemberChange(id: string) {
    setMemberId(id);
    setFeedback(null);
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
            practiceDays={practiceDays}
            amount={amount}
            type={type}
            onTypeChange={setType}
            testIDs={{
              date: "entry-date",
              amount: "entry-amount",
              typeMonthly: "entry-type-monthly",
              typeVisitor: "entry-type-visitor",
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
