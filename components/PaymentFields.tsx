import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { colors } from "@/lib/theme";
import { DateField } from "@/components/DateField";
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
      <View style={styles.field}>
        <Text style={styles.label}>もらった金額</Text>
        <TextInput
          testID={testIDs?.amount}
          value={amount}
          onChangeText={(t) => onAmountChange(t.replace(/[^0-9]/g, ""))}
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
            testID={testIDs?.typeMonthly}
            style={[styles.segment, type === "MONTHLY" && styles.segmentActive]}
            onPress={() => onTypeChange("MONTHLY")}
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
            testID={testIDs?.typeVisitor}
            style={[styles.segment, type === "VISITOR" && styles.segmentActive]}
            onPress={() => onTypeChange("VISITOR")}
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
    </>
  );
}

const styles = StyleSheet.create({
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
  segmented: { flexDirection: "row", gap: 8 },
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
