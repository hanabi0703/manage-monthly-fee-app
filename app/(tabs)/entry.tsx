import { useCallback, useState } from "react";
import { useFocusEffect, useRouter } from "expo-router";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSQLiteContext } from "expo-sqlite";
import { createPayment, getCurrentFee, listMembers, type PaymentType } from "@/lib/db";
import { todayIso, formatYen } from "@/lib/format";
import { colors } from "@/lib/theme";
import { Card, PrimaryButton, Screen, ScreenTitle } from "@/components/ui";
import { DateField } from "@/components/DateField";
import { NameField } from "@/components/NameField";

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
            <DateField
              testID="entry-date"
              label="日付"
              value={date}
              onChange={setDate}
            />
            <NameField
              label="メンバーの名前"
              value={name}
              onChange={setName}
              suggestions={memberNames}
            />
            <View style={styles.field}>
              <Text style={styles.label}>もらった金額</Text>
              <TextInput
                testID="entry-amount"
                value={amount}
                onChangeText={(t) => setAmount(t.replace(/[^0-9]/g, ""))}
                keyboardType="number-pad"
                placeholder="0"
                placeholderTextColor={colors.textFaint}
                style={styles.input}
              />
            </View>
            <View style={styles.field}>
              <Text style={styles.label}>区分</Text>
              <View style={styles.segmented}>
                <Pressable
                  testID="entry-type-monthly"
                  style={[
                    styles.segment,
                    type === "MONTHLY" && styles.segmentActive,
                  ]}
                  onPress={() => setType("MONTHLY")}
                >
                  <Text
                    style={[
                      styles.segmentText,
                      type === "MONTHLY" && styles.segmentTextActive,
                    ]}
                  >
                    月謝
                  </Text>
                </Pressable>
                <Pressable
                  testID="entry-type-visitor"
                  style={[
                    styles.segment,
                    type === "VISITOR" && styles.segmentActive,
                  ]}
                  onPress={() => setType("VISITOR")}
                >
                  <Text
                    style={[
                      styles.segmentText,
                      type === "VISITOR" && styles.segmentTextActive,
                    ]}
                  >
                    ビジター
                  </Text>
                </Pressable>
              </View>
            </View>
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
  field: { gap: 6 },
  label: { fontSize: 13, fontWeight: "600", color: colors.text },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    fontSize: 15,
    color: colors.text,
    backgroundColor: colors.card,
  },
  segmented: {
    flexDirection: "row",
    gap: 8,
  },
  segment: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: "center",
    backgroundColor: colors.card,
  },
  segmentActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  segmentText: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.text,
  },
  segmentTextActive: {
    color: colors.primaryText,
  },
});
