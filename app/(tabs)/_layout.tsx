import { Tabs } from "expo-router";
import type { ColorValue } from "react-native";
import { colors } from "@/lib/theme";
import { DoodleIcon, type DoodleIconName } from "@/components/DoodleIcon";

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.green,
        tabBarInactiveTintColor: colors.tabInactive,
        tabBarLabelStyle: { fontSize: 12, fontWeight: "700" },
        headerStyle: { backgroundColor: colors.card },
        headerTintColor: colors.text,
        headerTitleStyle: { fontWeight: "700" },
        tabBarStyle: {
          backgroundColor: colors.card,
          borderTopColor: colors.border,
          height: 64,
          paddingTop: 8,
          paddingBottom: 8,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "会計表",
          tabBarIcon: ({ color }) => tabIcon("accounting", color),
        }}
      />
      <Tabs.Screen
        name="entry"
        options={{
          title: "入力",
          tabBarIcon: ({ color }) => tabIcon("pencil", color),
        }}
      />
      <Tabs.Screen
        name="members"
        options={{
          title: "メンバー",
          tabBarIcon: ({ color }) => tabIcon("members", color),
        }}
      />
      <Tabs.Screen
        name="fee-settings"
        options={{
          title: "設定",
          tabBarIcon: ({ color }) => tabIcon("settings", color),
        }}
      />
    </Tabs>
  );
}

function tabIcon(name: DoodleIconName, color: ColorValue) {
  return <DoodleIcon name={name} size={24} color={color as string} />;
}
