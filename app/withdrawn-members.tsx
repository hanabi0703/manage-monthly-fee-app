import { useCallback, useState } from "react";
import { useFocusEffect } from "expo-router";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useSQLiteContext } from "expo-sqlite";
import { listWithdrawnMembers, updateMemberStatus, type Member } from "@/lib/db";
import { colors } from "@/lib/theme";
import { EmptyState, Screen, ScreenTitle } from "@/components/ui";
import { AppCard } from "@/components/AppCard";
import { AppButton } from "@/components/AppButton";
import { DoodleIcon } from "@/components/DoodleIcon";

export default function WithdrawnMembersScreen() {
  const db = useSQLiteContext();
  const [members, setMembers] = useState<Member[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [returningId, setReturningId] = useState<string | null>(null);

  const load = useCallback(() => {
    let cancelled = false;
    listWithdrawnMembers(db).then((rows) => {
      if (cancelled) return;
      setMembers(rows);
      setLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, [db]);

  useFocusEffect(load);

  async function handleReturn(id: string) {
    setReturningId(id);
    try {
      await updateMemberStatus(db, id, "ACTIVE");
      load();
    } finally {
      setReturningId(null);
    }
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.wrap} showsVerticalScrollIndicator={false}>
        <ScreenTitle
          title="退会メンバー"
          subtitle="退会したメンバーの一覧です。復帰するとメンバー一覧に戻ります。"
        />
        {loaded && members.length === 0 ? (
          <EmptyState>退会したメンバーはいません。</EmptyState>
        ) : (
          <AppCard style={styles.listCard}>
            {members.map((m, index) => (
              <View key={m.id} style={[styles.row, index > 0 && styles.rowDivider]}>
                <View style={styles.rowLeft}>
                  <DoodleIcon name="members" size={22} color={colors.tabInactive} />
                  <Text style={styles.name}>{m.name}</Text>
                </View>
                <AppButton
                  testID={`withdrawn-return-${m.id}`}
                  title={returningId === m.id ? "復帰中..." : "復帰する"}
                  variant="outline"
                  onPress={() => handleReturn(m.id)}
                  disabled={returningId !== null}
                />
              </View>
            ))}
          </AppCard>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 20, paddingBottom: 48, gap: 12 },
  listCard: { padding: 0, overflow: "hidden" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    paddingHorizontal: 18,
    gap: 12,
  },
  rowDivider: { borderTopWidth: 1, borderTopColor: colors.border },
  rowLeft: { flexDirection: "row", alignItems: "center", gap: 14, flexShrink: 1 },
  name: { fontSize: 16, fontWeight: "700", color: colors.text },
});
