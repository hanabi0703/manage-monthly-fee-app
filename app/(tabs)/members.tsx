import { useCallback, useState } from "react";
import { useFocusEffect, useRouter } from "expo-router";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useSQLiteContext } from "expo-sqlite";
import { listFeeSettings, listMembers, listPayments, upsertMemberByName } from "@/lib/db";
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
      <FlatList
        contentContainerStyle={styles.list}
        data={rows}
        keyExtractor={(r) => r.id}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View style={styles.headerBlock}>
            <ScreenTitle
              title="メンバー一覧"
              subtitle="繰越金・未払金の状況を確認できます。"
            />
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
            ) : null}
          </View>
        }
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
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerBlock: { gap: 12, marginBottom: 4 },
  addForm: { gap: 16, marginBottom: 8 },
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
