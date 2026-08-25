import { PropsWithChildren } from "react";
import { View, type ViewStyle, StyleSheet } from "react-native";
import { colors } from "@/lib/theme";

type Props = PropsWithChildren<{ style?: ViewStyle | ViewStyle[] }>;

export function AppCard({ children, style }: Props) {
  return <View style={[styles.card, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 18,
    shadowColor: "#000",
    shadowOpacity: 0.025,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 1,
  },
});
