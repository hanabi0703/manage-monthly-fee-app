import { useCallback, useEffect, useRef, useState } from "react";
import { useFocusEffect, useRouter } from "expo-router";
import { Alert, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSQLiteContext } from "expo-sqlite";
import {
  createPaymentForMember,
  getFeeForMonth,
  listMembers,
  listPracticeDays,
  type Member,
  type PaymentType,
  type PracticeDay,
} from "@/lib/db";
import { currentMonthIso, formatYen, shiftMonth, todayIso } from "@/lib/format";
import { colors } from "@/lib/theme";
import { Screen } from "@/components/ui";
import { AppCard } from "@/components/AppCard";
import { AppButton } from "@/components/AppButton";
import { MemberSelectField } from "@/components/MemberSelectField";
import { PaymentFields } from "@/components/PaymentFields";
import { AMOUNT_PRESETS, type AmountOption } from "@/components/AmountSelectField";

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
  const router = useRouter();

  const [date, setDate] = useState("");
  const [memberId, setMemberId] = useState("");
  const [amountOption, setAmountOption] = useState<AmountOption | null>(null);
  const [amount, setAmount] = useState("");
  const [type, setType] = useState<PaymentType>("MONTHLY");
  const [members, setMembers] = useState<Member[]>([]);
  const [practiceDays, setPracticeDays] = useState<PracticeDay[]>([]);
  const [currentFee, setCurrentFee] = useState(0);
  const [submitting, setSubmitting] = useState(false);

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

  // 月謝を選択している間は、日付（の月）に応じた月謝額をデフォルトとして入力する。
  useEffect(() => {
    if (type !== "MONTHLY" || !date) return;
    let cancelled = false;
    getFeeForMonth(db, date.slice(0, 7)).then((fee) => {
      if (cancelled) return;
      setCurrentFee(fee);
      const feeStr = String(fee);
      if ((AMOUNT_PRESETS as readonly string[]).includes(feeStr)) {
        setAmountOption(feeStr as AmountOption);
      } else {
        setAmountOption("OTHER");
      }
      setAmount(feeStr);
    });
    return () => {
      cancelled = true;
    };
  }, [db, date, type]);

  function handleTypeChange(next: PaymentType) {
    setType(next);
    if (next === "VISITOR") {
      setAmountOption(null);
      setAmount("");
    }
  }

  function handleAmountOptionChange(option: AmountOption) {
    setAmountOption(option);
    setAmount(option === "OTHER" ? "" : option);
  }

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
      await createPaymentForMember(db, { memberId, date, amount: amountNum, type });
      setMemberId("");
      setType("MONTHLY");
      router.push("/");
    } finally {
      setSubmitting(false);
    }
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
            onChange={setMemberId}
            members={members}
          />
          <PaymentFields
            date={date}
            onDateChange={setDate}
            practiceDays={practiceDays}
            amountOption={amountOption}
            onAmountOptionChange={handleAmountOptionChange}
            amount={amount}
            onAmountChange={setAmount}
            type={type}
            onTypeChange={handleTypeChange}
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
});
