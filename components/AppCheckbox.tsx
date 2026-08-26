import { Pressable, StyleSheet, Text } from "react-native";
import { colors } from "@/lib/theme";

type Props = {
  checked: boolean;
  onToggle: () => void;
  testID?: string;
};

export function AppCheckbox({ checked, onToggle, testID }: Props) {
  return (
    <Pressable
      testID={testID}
      onPress={onToggle}
      hitSlop={10}
      style={[styles.box, checked && styles.boxChecked]}
    >
      {checked ? <Text style={styles.check}>✓</Text> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  box: {
    width: 26,
    height: 26,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.card,
    alignItems: "center",
    justifyContent: "center",
  },
  boxChecked: {
    backgroundColor: colors.green,
    borderColor: colors.green,
  },
  check: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "800",
  },
});
