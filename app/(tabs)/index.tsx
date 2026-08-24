import { useCallback, useState } from "react";
import { useFocusEffect, useRouter } from "expo-router";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useSQLiteContext } from "expo-sqlite";
import { listMonths, type MonthSummary } from "@/lib/db";
import { formatMonthLabel, formatYen } from "@/lib/format";
import { colors } from "@/lib/theme";
import { EmptyState, Screen, ScreenTitle } from "@/components/ui";

export default function DashboardScreen() {
  const db = useSQLiteContext();
  const router = useRouter();
  const [months, setMonths] = useState<MonthSummary[]>([]);
  const [loaded, setLoaded] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      listMonths(db).then((rows) => {
        if (!cancelled) {
          setMonths(rows);
          setLoaded(true);
        }
      });
      return () => {
        cancelled = true;
      };
    }, [db]),
  );

  return (
    <Screen>
      <ScreenTitle
        title="会計表"
        subtitle="月ごとに、練習日×メンバーの支払い状況を確認できます。"
      />
      {loaded && months.length === 0 ? (
        <View style={styles.emptyWrap}>
          <EmptyState>
            まだ記録がありません。「設定」タブで練習日を登録するか、「入力」タブから記録してください。
          </EmptyState>
        </View>
      ) : (
        <FlatList
          contentContainerStyle={styles.list}
          data={months}
          keyExtractor={(m) => m.month}
          renderItem={({ item }) => (
            <Pressable
              testID={`month-row-${item.month}`}
              style={styles.row}
              onPress={() => router.push(`/accounting/${item.month}`)}
            >
              <Text style={styles.monthLabel}>{formatMonthLabel(item.month)}</Text>
              <Text style={styles.monthMeta}>
                練習日 {item.practiceDayCount}日 ・ 集金 {formatYen(item.totalCollected)}
              </Text>
            </Pressable>
          )}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  emptyWrap: { padding: 16 },
  list: { padding: 16 },
  row: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 14,
    gap: 4,
  },
  separator: { height: 10 },
  monthLabel: { fontSize: 16, fontWeight: "700", color: colors.text },
  monthMeta: { fontSize: 13, color: colors.textMuted },
});
