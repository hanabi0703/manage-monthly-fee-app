import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors } from "@/lib/theme";
import { Screen, ScreenTitle } from "@/components/ui";
import { AppCard } from "@/components/AppCard";
import { DoodleIcon, type DoodleIconName } from "@/components/DoodleIcon";

const menuItems: {
  key: string;
  label: string;
  description: string;
  icon: DoodleIconName;
  href: "/practice-days";
}[] = [
  {
    key: "practice-days",
    label: "練習日設定",
    description: "月ごとの練習日を登録・削除します。",
    icon: "calendar",
    href: "/practice-days",
  },
];

export default function SettingsScreen() {
  const router = useRouter();

  return (
    <Screen>
      <ScreenTitle title="設定" subtitle="各種設定はここから行えます。" />
      <View style={styles.list}>
        {menuItems.map((item) => (
          <Pressable
            key={item.key}
            testID={`settings-menu-${item.key}`}
            onPress={() => router.push(item.href)}
          >
            <AppCard style={styles.row}>
              <View style={styles.rowLeft}>
                <DoodleIcon name={item.icon} size={24} color={colors.tabInactive} />
                <View>
                  <Text style={styles.label}>{item.label}</Text>
                  <Text style={styles.description}>{item.description}</Text>
                </View>
              </View>
              <Text style={styles.chevron}>›</Text>
            </AppCard>
          </Pressable>
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { padding: 20, paddingTop: 4, gap: 12 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  rowLeft: { flexDirection: "row", alignItems: "center", gap: 14, flexShrink: 1 },
  label: { fontSize: 17, fontWeight: "700", color: colors.text },
  description: { fontSize: 12, color: colors.textMuted, marginTop: 4, maxWidth: 260 },
  chevron: { fontSize: 26, color: colors.textMuted },
});
