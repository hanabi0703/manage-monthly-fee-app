import { Tabs } from "expo-router";
import { Text, type ColorValue } from "react-native";
import { colors } from "@/lib/theme";

function TabIcon({ emoji, color }: { emoji: string; color: ColorValue }) {
  return <Text style={{ fontSize: 18, color }}>{emoji}</Text>;
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.text,
        tabBarInactiveTintColor: colors.textFaint,
        headerStyle: { backgroundColor: colors.card },
        headerTintColor: colors.text,
        tabBarStyle: { backgroundColor: colors.card, borderTopColor: colors.border },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "会計表",
          tabBarIcon: ({ color }) => <TabIcon emoji="📋" color={color} />,
        }}
      />
      <Tabs.Screen
        name="entry"
        options={{
          title: "入力",
          tabBarIcon: ({ color }) => <TabIcon emoji="✏️" color={color} />,
        }}
      />
      <Tabs.Screen
        name="members"
        options={{
          title: "メンバー",
          tabBarIcon: ({ color }) => <TabIcon emoji="👥" color={color} />,
        }}
      />
      <Tabs.Screen
        name="fee-settings"
        options={{
          title: "設定",
          tabBarIcon: ({ color }) => <TabIcon emoji="⚙️" color={color} />,
        }}
      />
    </Tabs>
  );
}
