import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors } from "@/lib/theme";
import { DateField } from "@/components/DateField";
import { AppInput } from "@/components/AppInput";
import type { PaymentType } from "@/lib/db";

type Props = {
  dateLabel?: string;
  date: string;
  onDateChange: (value: string) => void;
  amount: string;
  onAmountChange: (value: string) => void;
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
  amount,
  onAmountChange,
  type,
  onTypeChange,
  testIDs,
}: Props) {
  return (
    <>
      <DateField
        testID={testIDs?.date}
        label={dateLabel}
        value={date}
        onChange={onDateChange}
      />
      <AppInput
        testID={testIDs?.amount}
        label="もらった金額"
        value={amount}
        onChangeText={(t) => onAmountChange(t.replace(/[^0-9]/g, ""))}
        keyboardType="number-pad"
        placeholder="0"
      />
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
