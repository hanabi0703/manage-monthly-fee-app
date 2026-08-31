import { useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
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
      <Pressable testID={testID} style={styles.input} onPress={() => setOpen(true)}>
        <Text style={selected ? styles.valueText : styles.placeholder}>
          {selected ? selected.name : "選択してください"}
        </Text>
        <Text style={styles.chevron}>▼</Text>
      </Pressable>
      {/* アンカー要素に対する絶対配置+zIndexだと、React Native(iOS/Android)では
          兄弟要素(日付フィールドなど)の背後に隠れてしまうことがあるため、
          Modalで画面最前面に独立したレイヤーとして表示する。 */}
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <Text style={styles.sheetTitle}>{label}</Text>
            <ScrollView keyboardShouldPersistTaps="handled">
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
          </Pressable>
        </Pressable>
      </Modal>
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
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(37, 35, 31, 0.35)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  sheet: {
    width: "100%",
    maxWidth: 420,
    maxHeight: "70%",
    backgroundColor: colors.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
  },
  sheetTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.text,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  optionRow: {
    paddingVertical: 13,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderColor: colors.border,
  },
  optionText: { fontSize: 16, color: colors.text },
  optionTextSelected: { color: colors.green, fontWeight: "700" },
});
