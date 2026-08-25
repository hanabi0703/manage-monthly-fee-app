import { Pressable, Text, StyleSheet } from "react-native";
import { colors } from "@/lib/theme";

type Variant = "coral" | "green" | "outline";

type Props = {
  title: string;
  onPress?: () => void;
  disabled?: boolean;
  variant?: Variant;
  testID?: string;
};

export function AppButton({
  title,
  onPress,
  disabled = false,
  variant = "coral",
  testID,
}: Props) {
  const backgroundColor =
    variant === "coral" ? colors.coral : variant === "green" ? colors.green : "#FFFFFF";

  return (
    <Pressable
      testID={testID}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: disabled ? colors.disabled : backgroundColor },
        variant === "outline" && styles.outline,
        pressed && !disabled && styles.pressed,
      ]}
    >
      <Text style={[styles.text, variant === "outline" && styles.outlineText]}>
        {title}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 52,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 15,
    paddingHorizontal: 16,
  },
  outline: {
    borderWidth: 1,
    borderColor: colors.border,
  },
  pressed: {
    opacity: 0.85,
  },
  text: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  outlineText: {
    color: colors.text,
  },
});
