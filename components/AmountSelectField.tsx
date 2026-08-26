import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { colors } from "@/lib/theme";
import { formatYen } from "@/lib/format";

export const AMOUNT_PRESETS = ["1000", "2000", "3000", "4000", "5000"] as const;
export type AmountOption = (typeof AMOUNT_PRESETS)[number] | "OTHER";

type Props = {
  label?: string;
  option: AmountOption | null;
  onOptionChange: (option: AmountOption) => void;
  amount: string;
  onAmountChange: (value: string) => void;
  testID?: string;
};

export function AmountSelectField({
  label = "もらった金額",
  option,
  onOptionChange,
  amount,
  onAmountChange,
  testID,
}: Props) {
  const [open, setOpen] = useState(false);

  const headerLabel =
    option === "OTHER" ? "その他" : option ? formatYen(Number(option)) : "選択してください";

  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <Pressable testID={testID} style={styles.input} onPress={() => setOpen((o) => !o)}>
        <Text style={option ? styles.valueText : styles.placeholder}>{headerLabel}</Text>
        <Text style={styles.chevron}>{open ? "▲" : "▼"}</Text>
      </Pressable>
      {open ? (
        <View style={styles.dropdown}>
          {AMOUNT_PRESETS.map((preset) => (
            <Pressable
              key={preset}
              testID={`${testID}-option-${preset}`}
              style={styles.optionRow}
              onPress={() => {
                onOptionChange(preset);
                setOpen(false);
              }}
            >
              <Text style={[styles.optionText, option === preset && styles.optionTextSelected]}>
                {formatYen(Number(preset))}
              </Text>
            </Pressable>
          ))}
          <Pressable
            testID={`${testID}-option-other`}
            style={[styles.optionRow, styles.optionRowLast]}
            onPress={() => {
              onOptionChange("OTHER");
              setOpen(false);
            }}
          >
            <Text style={[styles.optionText, option === "OTHER" && styles.optionTextSelected]}>
              その他
            </Text>
          </Pressable>
        </View>
      ) : null}
      {option === "OTHER" ? (
        <TextInput
          testID={testID ? `${testID}-other-input` : undefined}
          value={amount}
          onChangeText={(t) => onAmountChange(t.replace(/[^0-9]/g, ""))}
          keyboardType="number-pad"
          placeholder="金額を入力"
          placeholderTextColor={colors.placeholder}
          style={styles.otherInput}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: 8 },
  label: { fontSize: 15, fontWeight: "700", color: colors.text },
  input: {
    minHeight: 54,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    backgroundColor: colors.card,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  valueText: { fontSize: 17, color: colors.text },
  placeholder: { fontSize: 17, color: colors.placeholder },
  chevron: { fontSize: 12, color: colors.textMuted },
  dropdown: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    backgroundColor: colors.card,
    overflow: "hidden",
  },
  optionRow: {
    paddingVertical: 13,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  optionRowLast: { borderBottomWidth: 0 },
  optionText: { fontSize: 16, color: colors.text },
  optionTextSelected: { color: colors.green, fontWeight: "700" },
  otherInput: {
    minHeight: 54,
    paddingHorizontal: 16,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    fontSize: 17,
    color: colors.text,
  },
});
