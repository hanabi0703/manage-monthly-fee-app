import { PropsWithChildren } from "react";
import { StyleSheet, Text, View } from "react-native";
import { colors } from "@/lib/theme";
import { AppCard } from "@/components/AppCard";

export function Screen({ children }: PropsWithChildren) {
  return <View style={styles.screen}>{children}</View>;
}

export function ScreenTitle({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <View style={styles.titleBlock}>
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

export function SectionLabel({ children }: PropsWithChildren) {
  return <Text style={styles.sectionLabel}>{children}</Text>;
}

export function EmptyState({ children }: PropsWithChildren) {
  return (
    <AppCard style={styles.emptyState}>
      <Text style={styles.emptyStateText}>{children}</Text>
    </AppCard>
  );
}

export function Badge({
  label,
  tone,
}: {
  label: string;
  tone: "monthly" | "visitor" | "unpaid" | "credit" | "neutral" | "leave";
}) {
  const toneStyles: Record<typeof tone, [string, string]> = {
    monthly: [colors.monthlyBg, colors.monthlyText],
    visitor: [colors.visitorBg, colors.visitorText],
    unpaid: [colors.unpaidBg, colors.unpaidText],
    credit: [colors.creditBg, colors.creditText],
    neutral: [colors.neutralBg, colors.neutralText],
    leave: [colors.leaveBg, colors.leaveText],
  };
  const [bg, fg] = toneStyles[tone];
  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <Text style={[styles.badgeText, { color: fg }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  titleBlock: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 8,
    gap: 6,
  },
  title: {
    fontSize: 25,
    fontWeight: "800",
    color: colors.text,
  },
  subtitle: {
    fontSize: 14,
    color: colors.textMuted,
    lineHeight: 20,
  },
  sectionLabel: {
    fontSize: 17,
    fontWeight: "700",
    color: colors.green,
    marginBottom: 10,
  },
  emptyState: {
    borderStyle: "dashed",
    alignItems: "center",
  },
  emptyStateText: {
    color: colors.textMuted,
    fontSize: 13,
    textAlign: "center",
    lineHeight: 20,
  },
  badge: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    alignSelf: "flex-start",
  },
  badgeText: {
    fontSize: 12,
    fontWeight: "700",
  },
});
