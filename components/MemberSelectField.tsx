import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { colors } from "@/lib/theme";
import type { Member } from "@/lib/db";

type Props = {
  label: string;
  value: string;
  onChange: (memberId: string) => void;
  members: Member[];
  testID?: string;
};

export function MemberSelectField({ label, value, onChange, members, testID }: Props) {
  const [open, setOpen] = useState(false);
  const selected = members.find((m) => m.id === value);

  if (members.length === 0) {
    return (
      <View style={styles.field}>
        <Text style={styles.label}>{label}</Text>
        <View style={[styles.input, styles.inputDisabled]}>
          <Text style={styles.placeholder}>メンバーがいません</Text>
        </View>
        <Text style={styles.hint}>「メンバー」タブから追加してください。</Text>
      </View>
    );
  }

  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <Pressable
        testID={testID}
        style={styles.input}
        onPress={() => setOpen((o) => !o)}
      >
        <Text style={selected ? styles.valueText : styles.placeholder}>
          {selected ? selected.name : "選択してください"}
        </Text>
        <Text style={styles.chevron}>{open ? "▲" : "▼"}</Text>
      </Pressable>
      {open ? (
        <View style={styles.dropdown}>
          <ScrollView nestedScrollEnabled keyboardShouldPersistTaps="handled">
            {members.map((m) => (
              <Pressable
                key={m.id}
                testID={`${testID}-option-${m.id}`}
                style={styles.optionRow}
                onPress={() => {
                  onChange(m.id);
                  setOpen(false);
                }}
              >
                <Text
                  style={[
                    styles.optionText,
                    m.id === value && styles.optionTextSelected,
                  ]}
                >
                  {m.name}
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
