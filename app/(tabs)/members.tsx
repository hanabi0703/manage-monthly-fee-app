import { useCallback, useState } from "react";
import { useFocusEffect, useRouter } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSQLiteContext } from "expo-sqlite";
import { getFeeForMonths, listMembers, listPayments, upsertMemberByName } from "@/lib/db";
import { computeBalance } from "@/lib/balance";
import { formatYen } from "@/lib/format";
import { colors } from "@/lib/theme";
import { Badge, EmptyState, Screen, ScreenTitle, SectionLabel } from "@/components/ui";
import { AppCard } from "@/components/AppCard";
import { AppButton } from "@/components/AppButton";
import { AppInput } from "@/components/AppInput";
import { DoodleIcon } from "@/components/DoodleIcon";

type Row = { id: string; name: string; balance: number };

export default function MembersScreen() {
  const db = useSQLiteContext();
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [newName, setNewName] = useState("");
  const [adding, setAdding] = useState(false);

  const load = useCallback(() => {
    let cancelled = false;
    Promise.all([listMembers(db), listPayments(db)]).then(
      async ([members, payments]) => {
        if (cancelled) return;
        const months = Array.from(new Set(payments.map((p) => p.date.slice(0, 7))));
        const fees = await getFeeForMonths(db, months);
        if (cancelled) return;
        const computed = members.map((m) => {
          const monthly = payments.filter(
            (p) => p.memberId === m.id && p.type === "MONTHLY",
          );
          return {
            id: m.id,
            name: m.name,
            balance: computeBalance(monthly, (month) => fees[month] ?? 0),
          };
        });
        // 未払い(balance < 0)のメンバーを優先し、それ以外は元の並び(名前昇順)を保つ。
        const sorted = [...computed].sort(
          (a, b) => Number(a.balance >= 0) - Number(b.balance >= 0),
        );
        setRows(sorted);
        setLoaded(true);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [db]);

  useFocusEffect(load);

  async function handleAddMember() {
    const trimmed = newName.trim();
    if (!trimmed) return;
    setAdding(true);
    try {
      await upsertMemberByName(db, trimmed);
      setNewName("");
      load();
    } finally {
      setAdding(false);
    }
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
        <ScreenTitle title="メンバー一覧" subtitle="繰越金・未払金の状況を確認できます。" />
        <SectionLabel>メンバーを追加</SectionLabel>
        <AppCard style={styles.addForm}>
          <AppInput
            testID="new-member-name"
            label="名前"
            value={newName}
            onChangeText={setNewName}
            placeholder="例：山田太郎"
          />
          <AppButton
            testID="new-member-submit"
            title={adding ? "追加中..." : "追加する"}
            onPress={handleAddMember}
            disabled={!newName.trim() || adding}
          />
        </AppCard>
        {loaded && rows.length === 0 ? (
          <EmptyState>まだメンバーが登録されていません。</EmptyState>
        ) : (
          <AppCard style={styles.listCard}>
            {rows.map((item, index) => (
              <Pressable
                key={item.id}
                testID={`member-row-${item.id}`}
                onPress={() => router.push(`/members/${item.id}`)}
                style={[styles.row, index > 0 && styles.rowDivider]}
              >
                <View style={styles.rowLeft}>
                  <DoodleIcon name="members" size={22} color={colors.tabInactive} />
                  <View>
                    <View style={styles.nameRow}>
                      <Text style={styles.name}>{item.name}</Text>
                      {item.balance < 0 ? (
                        <View testID={`member-unpaid-badge-${item.id}`} style={styles.unpaidBadge}>
                          <Text style={styles.unpaidBadgeText}>未払い</Text>
                        </View>
                      ) : null}
                    </View>
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
              </Pressable>
            ))}
          </AppCard>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { padding: 20, paddingTop: 4, paddingBottom: 48, gap: 12 },
  addForm: { gap: 16, marginBottom: 8 },
  listCard: { padding: 0, overflow: "hidden" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    paddingHorizontal: 18,
  },
  rowDivider: { borderTopWidth: 1, borderTopColor: colors.border },
  rowLeft: { flexDirection: "row", alignItems: "center", gap: 14 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
  name: { fontSize: 18, fontWeight: "700", color: colors.text },
  unpaidBadge: {
    backgroundColor: colors.coral,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  unpaidBadgeText: { fontSize: 10.5, fontWeight: "700", color: "#FFFFFF" },
  chevron: { fontSize: 26, color: colors.textMuted },
});
