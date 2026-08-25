import { useCallback, useState } from "react";
import { useFocusEffect, useRouter } from "expo-router";
import { Alert, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSQLiteContext } from "expo-sqlite";
import {
  createPaymentForMember,
  getCurrentFee,
  listMembers,
  type Member,
  type PaymentType,
} from "@/lib/db";
import { todayIso, formatYen } from "@/lib/format";
import { colors } from "@/lib/theme";
import { Screen } from "@/components/ui";
import { AppCard } from "@/components/AppCard";
import { AppButton } from "@/components/AppButton";
import { MemberSelectField } from "@/components/MemberSelectField";
import { PaymentFields } from "@/components/PaymentFields";

export default function EntryScreen() {
  const db = useSQLiteContext();
  const router = useRouter();

  const [date, setDate] = useState(todayIso());
  const [memberId, setMemberId] = useState("");
  const [amount, setAmount] = useState("");
  const [type, setType] = useState<PaymentType>("MONTHLY");
  const [members, setMembers] = useState<Member[]>([]);
  const [currentFee, setCurrentFee] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      Promise.all([listMembers(db), getCurrentFee(db)]).then(
        ([memberList, fee]) => {
          if (cancelled) return;
          setMembers(memberList);
          setCurrentFee(fee);
          setAmount((prev) => (prev ? prev : fee > 0 ? String(fee) : ""));
        },
      );
      return () => {
        cancelled = true;
      };
    }, [db]),
  );

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
      setAmount(currentFee > 0 ? String(currentFee) : "");
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
            amount={amount}
            onAmountChange={setAmount}
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
