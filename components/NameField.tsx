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
        placeholder="例: 山田太郎"
        placeholderTextColor={colors.textFaint}
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
  hint: { fontSize: 12, color: colors.textFaint },
  suggestions: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    backgroundColor: colors.card,
    overflow: "hidden",
  },
  suggestionRow: {
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  suggestionText: { fontSize: 14, color: colors.text },
});
