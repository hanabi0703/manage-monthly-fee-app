import { useCallback, useState } from "react";
import { useFocusEffect, useRouter } from "expo-router";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useSQLiteContext } from "expo-sqlite";
import { listFeeSettings, listMembers, listPayments } from "@/lib/db";
import { computeBalance } from "@/lib/balance";
import { formatYen } from "@/lib/format";
import { colors } from "@/lib/theme";
import { Badge, EmptyState, Screen, ScreenTitle } from "@/components/ui";

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
              style={styles.row}
              onPress={() => router.push(`/members/${item.id}`)}
            >
              <Text style={styles.name}>{item.name}</Text>
              {item.balance < 0 ? (
                <Badge label={`未払金 ${formatYen(Math.abs(item.balance))}`} tone="unpaid" />
              ) : item.balance > 0 ? (
                <Badge label={`繰越金 ${formatYen(item.balance)}`} tone="credit" />
              ) : (
                <Badge label="精算済み" tone="neutral" />
              )}
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
  list: { paddingHorizontal: 16, paddingBottom: 24 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 14,
  },
  separator: { height: 10 },
  name: { fontSize: 15, fontWeight: "600", color: colors.text },
});
