import { useCallback, useState } from "react";
import { useFocusEffect, useRouter } from "expo-router";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useSQLiteContext } from "expo-sqlite";
import { listFeeSettings, listMembers, listPayments } from "@/lib/db";
import { computeBalance } from "@/lib/balance";
import { formatYen } from "@/lib/format";
import { colors } from "@/lib/theme";
import { Badge, EmptyState, Screen, ScreenTitle } from "@/components/ui";
import { AppCard } from "@/components/AppCard";
import { DoodleIcon } from "@/components/DoodleIcon";

type Row = { id: string; name: string; balance: number };

export default function MembersScreen() {
  const db = useSQLiteContext();
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>([]);
  const [loaded, setLoaded] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      Promise.all([listMembers(db), listPayments(db), listFeeSettings(db)]).then(
        ([members, payments, settings]) => {
          if (cancelled) return;
          const computed = members.map((m) => {
            const monthly = payments.filter(
              (p) => p.memberId === m.id && p.type === "MONTHLY",
            );
            return { id: m.id, name: m.name, balance: computeBalance(monthly, settings) };
          });
          setRows(computed);
          setLoaded(true);
        },
      );
      return () => {
        cancelled = true;
      };
    }, [db]),
  );

  return (
    <Screen>
      <ScreenTitle
        title="メンバー一覧"
        subtitle="繰越金・未払金の状況を確認できます。"
      />
      {loaded && rows.length === 0 ? (
        <View style={styles.emptyWrap}>
          <EmptyState>まだメンバーが登録されていません。</EmptyState>
        </View>
      ) : (
        <FlatList
          contentContainerStyle={styles.list}
          data={rows}
          keyExtractor={(r) => r.id}
          renderItem={({ item }) => (
            <Pressable
              testID={`member-row-${item.id}`}
              onPress={() => router.push(`/members/${item.id}`)}
            >
              <AppCard style={styles.row}>
                <View style={styles.rowLeft}>
                  <DoodleIcon name="members" size={22} color={colors.tabInactive} />
                  <View>
                    <Text style={styles.name}>{item.name}</Text>
                    {item.balance < 0 ? (
                      <Badge label={`未払金 ${formatYen(Math.abs(item.balance))}`} tone="unpaid" />
                    ) : item.balance > 0 ? (
                      <Badge label={`繰越金 ${formatYen(item.balance)}`} tone="credit" />
                    ) : (
                      <Badge label="精算済み" tone="neutral" />
                    )}
                  </View>
                </View>
                <Text style={styles.chevron}>›</Text>
              </AppCard>
            </Pressable>
          )}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  emptyWrap: { padding: 20 },
  list: { padding: 20, paddingTop: 4 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  rowLeft: { flexDirection: "row", alignItems: "center", gap: 14 },
  separator: { height: 12 },
  name: { fontSize: 18, fontWeight: "700", color: colors.text, marginBottom: 8 },
  chevron: { fontSize: 26, color: colors.textMuted },
});
