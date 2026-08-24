import { useCallback, useState } from "react";
import { useFocusEffect, useLocalSearchParams } from "expo-router";
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useSQLiteContext } from "expo-sqlite";
import {
  deletePayment,
  getMember,
  listFeeSettings,
  listPaymentsForMember,
  type FeeSetting,
  type Member,
  type Payment,
} from "@/lib/db";
import { computeBalance, standardFeeAt } from "@/lib/balance";
import { formatDate, formatYen } from "@/lib/format";
import { colors } from "@/lib/theme";
import { Badge, Card, EmptyState, Screen, SectionLabel } from "@/components/ui";

export default function MemberDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const db = useSQLiteContext();
  const [member, setMember] = useState<Member | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [settings, setSettings] = useState<FeeSetting[]>([]);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(() => {
    if (!id) return () => {};
    let cancelled = false;
    Promise.all([
      getMember(db, id),
      listPaymentsForMember(db, id),
      listFeeSettings(db),
    ]).then(([m, p, s]) => {
      if (cancelled) return;
      setMember(m);
      setPayments(p);
      setSettings(s);
      setLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, [db, id]);

  useFocusEffect(load);

  async function handleDelete(paymentId: string) {
    await deletePayment(db, paymentId);
    load();
  }

  const monthlyPayments = payments.filter((p) => p.type === "MONTHLY");
  const balance = computeBalance(monthlyPayments, settings);

  if (loaded && !member) {
    return (
      <Screen>
        <View style={styles.wrap}>
          <EmptyState>メンバーが見つかりませんでした。</EmptyState>
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <FlatList
        contentContainerStyle={styles.wrap}
        data={payments}
        keyExtractor={(p) => p.id}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.name}>{member?.name ?? ""}さんのページ</Text>
            <Text style={styles.subtitle}>
              誰でも閲覧できます。支払い履歴と繰越金・未払金の状況です。
            </Text>
            <Card style={styles.balanceCard}>
              {balance < 0 ? (
                <>
                  <Text style={styles.balanceLabel}>未払金</Text>
                  <Text style={[styles.balanceValue, { color: colors.unpaidText }]}>
                    {formatYen(Math.abs(balance))}
                  </Text>
                  <Text style={styles.balanceNote}>
                    月謝の合計支払額が標準額に対して不足しています。
                  </Text>
                </>
              ) : balance > 0 ? (
                <>
                  <Text style={styles.balanceLabel}>繰越金</Text>
                  <Text style={[styles.balanceValue, { color: colors.creditText }]}>
                    {formatYen(balance)}
                  </Text>
                  <Text style={styles.balanceNote}>
                    月謝を標準額より多く払っているため、繰り越されています。
                  </Text>
                </>
              ) : (
                <>
                  <Text style={styles.balanceLabel}>未払金・繰越金</Text>
                  <Text style={styles.balanceValue}>なし（精算済み）</Text>
                </>
              )}
            </Card>
            <View style={styles.historyHeader}>
              <SectionLabel>支払い履歴</SectionLabel>
            </View>
            {payments.length === 0 ? (
              <EmptyState>まだ支払い記録がありません。</EmptyState>
            ) : null}
          </View>
        }
        renderItem={({ item }) => {
          const std =
            item.type === "MONTHLY" ? standardFeeAt(item.date, settings) : null;
          const diff = std === null ? null : item.amount - std;
          return (
            <View style={styles.paymentRow}>
              <View style={styles.paymentInfo}>
                <Text style={styles.paymentDate}>{formatDate(item.date)}</Text>
                <View style={styles.paymentMeta}>
                  {item.type === "MONTHLY" ? (
                    <Badge label="月謝" tone="monthly" />
                  ) : (
                    <Badge label="ビジター" tone="visitor" />
                  )}
                  <Text style={styles.paymentAmount}>{formatYen(item.amount)}</Text>
                  {diff !== null && diff !== 0 ? (
                    <Text
                      style={{
                        color: diff > 0 ? colors.creditText : colors.unpaidText,
                        fontSize: 12,
                      }}
                    >
                      {diff > 0 ? "+" : ""}
                      {formatYen(diff)}
                    </Text>
                  ) : null}
                </View>
              </View>
              <Pressable
                onPress={() =>
                  Alert.alert("削除しますか？", undefined, [
                    { text: "キャンセル", style: "cancel" },
                    {
                      text: "削除",
                      style: "destructive",
                      onPress: () => handleDelete(item.id),
                    },
                  ])
                }
              >
                <Text style={styles.deleteText}>削除</Text>
              </Pressable>
            </View>
          );
        }}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 16, paddingBottom: 32 },
  header: { gap: 12, marginBottom: 4 },
  name: { fontSize: 20, fontWeight: "700", color: colors.text },
  subtitle: { fontSize: 13, color: colors.textMuted },
  balanceCard: { gap: 4 },
  balanceLabel: { fontSize: 13, color: colors.textMuted },
  balanceValue: { fontSize: 26, fontWeight: "700", color: colors.text },
  balanceNote: { fontSize: 12, color: colors.textFaint, marginTop: 4 },
  historyHeader: { marginTop: 8 },
  paymentRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  paymentInfo: { gap: 6 },
  paymentDate: { fontSize: 14, fontWeight: "600", color: colors.text },
  paymentMeta: { flexDirection: "row", alignItems: "center", gap: 8 },
  paymentAmount: { fontSize: 13, color: colors.text },
  deleteText: { fontSize: 12, color: colors.textFaint },
  separator: { height: 8 },
});
