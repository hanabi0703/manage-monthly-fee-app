import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors } from "@/lib/theme";
import { formatYen } from "@/lib/format";
import { PracticeDaySelectField } from "@/components/PracticeDaySelectField";
import type { PaymentType, PracticeDay } from "@/lib/db";

type Props = {
  dateLabel?: string;
  date: string;
  onDateChange: (value: string) => void;
  practiceDays: PracticeDay[];
  amount: string;
  type: PaymentType;
  onTypeChange: (value: PaymentType) => void;
  testIDs?: {
    date?: string;
    amount?: string;
    typeMonthly?: string;
    typeVisitor?: string;
  };
};

export function PaymentFields({
  dateLabel = "日付",
  date,
  onDateChange,
  practiceDays,
  amount,
  type,
  onTypeChange,
  testIDs,
}: Props) {
  return (
    <>
      <PracticeDaySelectField
        testID={testIDs?.date}
        label={dateLabel}
        value={date}
        onChange={onDateChange}
        practiceDays={practiceDays}
      />
      <View style={styles.field}>
        <Text style={styles.label}>もらった金額</Text>
        <View testID={testIDs?.amount} style={styles.amountDisplay}>
          <Text style={styles.amountText}>{formatYen(Number(amount || 0))}</Text>
        </View>
      </View>
      <View style={styles.field}>
        <Text style={styles.label}>区分</Text>
        <View style={styles.typeRow}>
          <Pressable
            testID={testIDs?.typeMonthly}
            style={[styles.typeButton, type === "MONTHLY" && styles.typeSelected]}
            onPress={() => onTypeChange("MONTHLY")}
          >
            <Text
              style={[styles.typeText, type === "MONTHLY" && styles.typeSelectedText]}
            >
              月謝
            </Text>
          </Pressable>
          <Pressable
            testID={testIDs?.typeVisitor}
            style={[styles.typeButton, type === "VISITOR" && styles.typeSelected]}
            onPress={() => onTypeChange("VISITOR")}
          >
            <Text
              style={[styles.typeText, type === "VISITOR" && styles.typeSelectedText]}
            >
              ビジター
            </Text>
          </Pressable>
        </View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  field: { gap: 8 },
  label: { fontSize: 15, fontWeight: "700", color: colors.text },
  amountDisplay: {
    minHeight: 54,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    backgroundColor: colors.bg,
    justifyContent: "center",
  },
  amountText: { fontSize: 17, color: colors.text, fontWeight: "700" },
  typeRow: { flexDirection: "row", gap: 10 },
  typeButton: {
    flex: 1,
    height: 50,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "#FFFFFF",
  },
  typeSelected: {
    backgroundColor: colors.green,
    borderColor: colors.green,
  },
  typeText: { color: colors.text, fontSize: 15, fontWeight: "700" },
  typeSelectedText: { color: "#FFFFFF" },
});
