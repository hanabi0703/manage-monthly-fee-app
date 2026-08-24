import { useCallback, useState } from "react";
import { useFocusEffect, useRouter } from "expo-router";
import { Alert, ScrollView, StyleSheet, View } from "react-native";
import { useSQLiteContext } from "expo-sqlite";
import { createPayment, getCurrentFee, listMembers, type PaymentType } from "@/lib/db";
import { todayIso, formatYen } from "@/lib/format";
import { Card, PrimaryButton, Screen, ScreenTitle } from "@/components/ui";
import { NameField } from "@/components/NameField";
import { PaymentFields } from "@/components/PaymentFields";

export default function EntryScreen() {
  const db = useSQLiteContext();
  const router = useRouter();

  const [date, setDate] = useState(todayIso());
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [type, setType] = useState<PaymentType>("MONTHLY");
  const [memberNames, setMemberNames] = useState<string[]>([]);
  const [currentFee, setCurrentFee] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      Promise.all([listMembers(db), getCurrentFee(db)]).then(
        ([members, fee]) => {
          if (cancelled) return;
          setMemberNames(members.map((m) => m.name));
          setCurrentFee(fee);
          setAmount((prev) => (prev ? prev : fee > 0 ? String(fee) : ""));
        },
      );
      return () => {
        cancelled = true;
      };
    }, [db]),
  );

  const canSubmit = date.length === 10 && name.trim().length > 0 && amount.length > 0;

  async function handleSubmit() {
    const amountNum = Number(amount);
    if (!Number.isFinite(amountNum) || amountNum < 0) {
      Alert.alert("金額が正しくありません");
      return;
    }
    if (!name.trim()) {
      Alert.alert("名前を入力してください");
      return;
    }
    setSubmitting(true);
    try {
      await createPayment(db, { date, name: name.trim(), amount: amountNum, type });
      setName("");
      setAmount(currentFee > 0 ? String(currentFee) : "");
      setType("MONTHLY");
      router.push("/");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Screen>
      <ScrollView keyboardShouldPersistTaps="handled">
        <ScreenTitle
          title="支払いを記録"
          subtitle={`現在の月謝額: ${formatYen(currentFee)}`}
        />
        <View style={styles.formWrap}>
          <Card style={styles.form}>
            <NameField
              label="メンバーの名前"
              value={name}
              onChange={setName}
              suggestions={memberNames}
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
            <PrimaryButton
              testID="entry-submit"
              label={submitting ? "登録中..." : "登録する"}
              onPress={handleSubmit}
              disabled={!canSubmit || submitting}
            />
          </Card>
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  formWrap: { padding: 16 },
  form: { gap: 16 },
});
