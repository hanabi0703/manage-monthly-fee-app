import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { colors } from "@/lib/theme";

type Props = {
  label: string;
  value: string;
  onChange: (name: string) => void;
  suggestions: string[];
};

export function NameField({ label, value, onChange, suggestions }: Props) {
  const [focused, setFocused] = useState(false);

  const filtered = useMemo(() => {
    if (!value) return suggestions.slice(0, 8);
    return suggestions
      .filter((s) => s.toLowerCase().includes(value.toLowerCase()))
      .slice(0, 8);
  }, [value, suggestions]);

  const showSuggestions = focused && filtered.length > 0;

  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        onFocus={() => setFocused(true)}
        onBlur={() => setTimeout(() => setFocused(false), 150)}
        placeholder="例：山田太郎"
        placeholderTextColor={colors.placeholder}
        style={styles.input}
      />
      {showSuggestions ? (
        <View style={styles.suggestions}>
          {filtered.map((name) => (
            <Pressable
              key={name}
              style={styles.suggestionRow}
              onPress={() => {
                onChange(name);
                setFocused(false);
              }}
            >
              <Text style={styles.suggestionText}>{name}</Text>
            </Pressable>
          ))}
        </View>
      ) : (
        <Text style={styles.hint}>
          新しい名前を入力すると自動的にメンバーが追加されます。
        </Text>
      )}
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
    fontSize: 17,
    color: colors.text,
    backgroundColor: colors.card,
  },
  hint: { fontSize: 12, color: colors.textMuted, lineHeight: 18 },
  suggestions: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    backgroundColor: colors.card,
    overflow: "hidden",
  },
  suggestionRow: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  suggestionText: { fontSize: 15, color: colors.text },
});
