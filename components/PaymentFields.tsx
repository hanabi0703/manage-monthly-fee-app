import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { colors } from "@/lib/theme";
import { formatYen } from "@/lib/format";
import { PracticeDaySelectField } from "@/components/PracticeDaySelectField";
import type { PaymentType, PracticeDay } from "@/lib/db";

type Props = {
  dateLabel?: string;
  date: string;
  onDateChange: (value: string) => void;
  practiceDays: PracticeDay[];
  dateEmptyTitle?: string;
  dateEmptyHint?: string;
  amount: string;
  amountEditable?: boolean;
  onAmountChange?: (value: string) => void;
  type: PaymentType;
  showShortfallOption?: boolean;
  isShortfallMode?: boolean;
  onSelectFullAmount?: () => void;
  onSelectShortfall?: () => void;
  testIDs?: {
    date?: string;
    amount?: string;
    typeFull?: string;
    typeShortfall?: string;
  };
};

export function PaymentFields({
  dateLabel = "日付",
  date,
  onDateChange,
  practiceDays,
  dateEmptyTitle,
  dateEmptyHint,
  amount,
  amountEditable = false,
  onAmountChange,
  type,
  showShortfallOption = false,
  isShortfallMode = false,
  onSelectFullAmount,
  onSelectShortfall,
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
        emptyTitle={dateEmptyTitle}
        emptyHint={dateEmptyHint}
      />
      <View style={styles.field}>
        <Text style={styles.label}>もらった金額</Text>
        {amountEditable ? (
          <TextInput
            testID={testIDs?.amount}
            value={amount}
            onChangeText={(t) => onAmountChange?.(t.replace(/[^0-9]/g, ""))}
            keyboardType="number-pad"
            placeholder="0"
            placeholderTextColor={colors.placeholder}
            style={styles.amountInput}
          />
        ) : (
          <View testID={testIDs?.amount} style={styles.amountDisplay}>
            <Text style={styles.amountText}>{formatYen(Number(amount || 0))}</Text>
          </View>
        )}
      </View>
      <View style={styles.field}>
        <Text style={styles.label}>区分</Text>
        {type === "VISITOR" ? (
          <View style={[styles.typeButton, styles.typeSelected]}>
            <Text style={[styles.typeText, styles.typeSelectedText]}>ビジター</Text>
          </View>
        ) : (
          <View style={styles.typeRow}>
            <Pressable
              testID={testIDs?.typeFull}
              style={[styles.typeButton, !isShortfallMode && styles.typeSelected]}
              onPress={onSelectFullAmount}
            >
              <Text style={[styles.typeText, !isShortfallMode && styles.typeSelectedText]}>
                月謝（全額）
              </Text>
            </Pressable>
            {showShortfallOption ? (
              <Pressable
                testID={testIDs?.typeShortfall}
                style={[styles.typeButton, isShortfallMode && styles.typeSelected]}
                onPress={onSelectShortfall}
              >
                <Text style={[styles.typeText, isShortfallMode && styles.typeSelectedText]}>
                  不足金支払い
                </Text>
              </Pressable>
            ) : null}
          </View>
        )}
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
  amountInput: {
    minHeight: 54,
    paddingHorizontal: 16,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    fontSize: 17,
    fontWeight: "700",
    color: colors.text,
  },
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
