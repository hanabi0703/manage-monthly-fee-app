import { Suspense } from "react";
import { ActivityIndicator, View } from "react-native";
import { SQLiteProvider } from "expo-sqlite";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { migrateDbIfNeeded } from "@/lib/db";
import { colors } from "@/lib/theme";

function LoadingScreen() {
  return (
    <View
      style={{
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: colors.bg,
      }}
    >
      <ActivityIndicator size="large" color={colors.text} />
    </View>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <Suspense fallback={<LoadingScreen />}>
        <SQLiteProvider
          databaseName="monthly-fee.db"
          onInit={migrateDbIfNeeded}
          useSuspense
        >
          <StatusBar style="dark" />
          <Stack
            screenOptions={{
              headerStyle: { backgroundColor: colors.card },
              headerTintColor: colors.text,
              headerTitleStyle: { fontWeight: "700", color: colors.text },
              headerBackTitle: "",
              contentStyle: { backgroundColor: colors.bg },
            }}
          >
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen
              name="members/[id]/index"
              options={{ title: "メンバー詳細" }}
            />
            <Stack.Screen
              name="members/[id]/edit"
              options={{ title: "メンバー編集" }}
            />
            <Stack.Screen
              name="fee-history/[month]"
              options={{ title: "月謝設定" }}
            />
            <Stack.Screen
              name="practice-days"
              options={{ title: "練習日設定" }}
            />
          </Stack>
        </SQLiteProvider>
      </Suspense>
    </SafeAreaProvider>
  );
}
