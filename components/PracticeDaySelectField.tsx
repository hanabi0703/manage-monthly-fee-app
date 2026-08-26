import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { colors } from "@/lib/theme";
import { formatDate } from "@/lib/format";
import type { PracticeDay } from "@/lib/db";

type Props = {
  label?: string;
  value: string;
  onChange: (date: string) => void;
  practiceDays: PracticeDay[];
  testID?: string;
};

export function PracticeDaySelectField({
  label = "日付",
  value,
  onChange,
  practiceDays,
  testID,
}: Props) {
  const [open, setOpen] = useState(false);

  if (practiceDays.length === 0) {
    return (
      <View style={styles.field}>
        <Text style={styles.label}>{label}</Text>
        <View style={[styles.input, styles.inputDisabled]}>
          <Text style={styles.placeholder}>練習日が登録されていません</Text>
        </View>
        <Text style={styles.hint}>「設定」タブの練習日設定から登録してください。</Text>
      </View>
    );
  }

  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <Pressable testID={testID} style={styles.input} onPress={() => setOpen((o) => !o)}>
        <Text style={value ? styles.valueText : styles.placeholder}>
          {value ? formatDate(value) : "選択してください"}
        </Text>
        <Text style={styles.chevron}>{open ? "▲" : "▼"}</Text>
      </Pressable>
      {open ? (
        <View style={styles.dropdown}>
          <ScrollView nestedScrollEnabled keyboardShouldPersistTaps="handled">
            {practiceDays.map((d) => (
              <Pressable
                key={d.id}
                testID={`${testID}-option-${d.date}`}
                style={styles.optionRow}
                onPress={() => {
                  onChange(d.date);
                  setOpen(false);
                }}
              >
                <Text
                  style={[styles.optionText, d.date === value && styles.optionTextSelected]}
                >
                  {formatDate(d.date)}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
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
  inputDisabled: {
    backgroundColor: colors.bg,
  },
  valueText: { fontSize: 17, color: colors.text },
  placeholder: { fontSize: 17, color: colors.placeholder },
  chevron: { fontSize: 12, color: colors.textMuted },
  hint: { fontSize: 12, color: colors.textMuted, lineHeight: 18 },
  dropdown: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    backgroundColor: colors.card,
    overflow: "hidden",
    maxHeight: 260,
  },
  optionRow: {
    paddingVertical: 13,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  optionText: { fontSize: 16, color: colors.text },
  optionTextSelected: { color: colors.green, fontWeight: "700" },
});
