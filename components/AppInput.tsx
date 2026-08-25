import { View, Text, TextInput, type TextInputProps, StyleSheet } from "react-native";
import { colors } from "@/lib/theme";

type Props = TextInputProps & {
  label: string;
  testID?: string;
};

export function AppInput({ label, style, testID, ...props }: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        testID={testID}
        {...props}
        placeholderTextColor={colors.placeholder}
        style={[styles.input, style]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 8 },
  label: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.text,
  },
  input: {
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
