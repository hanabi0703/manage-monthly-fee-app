import { useCallback, useState } from "react";
import { useFocusEffect, useRouter } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSQLiteContext } from "expo-sqlite";
import {
  getFeeForMonths,
  listMembers,
  listMemberMonthStatusForMonth,
  listPayments,
  listUnpaidVisitorAttendance,
  upsertMember,
  type MemberStatus,
} from "@/lib/db";
import { computeBalance } from "@/lib/balance";
import { currentMonthIso, formatYen, isKanaOnly, toKatakana } from "@/lib/format";
import { colors } from "@/lib/theme";
import { Badge, EmptyState, Screen, ScreenTitle, SectionLabel } from "@/components/ui";
import { AppCard } from "@/components/AppCard";
import { AppButton } from "@/components/AppButton";
import { AppInput } from "@/components/AppInput";
import { DoodleIcon } from "@/components/DoodleIcon";

type Row = {
  id: string;
  name: string;
  status: MemberStatus;
  balance: number;
  hasUnpaidVisitorFee: boolean;
};

export default function MembersScreen() {
  const db = useSQLiteContext();
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [newName, setNewName] = useState("");
  const [newFurigana, setNewFurigana] = useState("");
  const [adding, setAdding] = useState(false);

  function handleNameChange(value: string) {
    setNewName(value);
    // 入力中の名前がひらがな/カタカナのみの間は、その読みをそのまま
    // カタカナのふりがなとして反映する。IMEで漢字に変換した後は
    // (=ひらがなのみでなくなった時点で)自動更新を止め、変換前の読みを
    // ふりがなとして残す。
    if (isKanaOnly(value)) {
      setNewFurigana(toKatakana(value));
    }
  }

  const load = useCallback(() => {
    let cancelled = false;
    const currentMonth = currentMonthIso();
    Promise.all([
      listMembers(db),
      listPayments(db),
      listMemberMonthStatusForMonth(db, currentMonth),
      listUnpaidVisitorAttendance(db),
    ]).then(async ([members, payments, currentMonthStatus, unpaidVisitorDates]) => {
      if (cancelled) return;
      const months = Array.from(
        new Set([...payments.map((p) => p.date.slice(0, 7)), currentMonth]),
      );
      const fees = await getFeeForMonths(db, months);
      if (cancelled) return;
      const currentMonthFee = fees[currentMonth] ?? 0;
      const unpaidVisitorMemberIds = new Set(unpaidVisitorDates.map((d) => d.memberId));
      const computed = members.map((m) => {
        const monthly = payments.filter(
          (p) => p.memberId === m.id && p.type === "MONTHLY",
        );
        const balance = computeBalance(monthly, (month) => fees[month] ?? 0);
        // その月の初日以降、月謝の人がまだ今月分を一切払っていない場合は
        // 未払いとして扱う(computeBalanceは実際の支払い記録のみを見るため、
        // 一度も払っていない月は考慮されない)。
        const paidThisMonth = monthly
          .filter((p) => p.date.slice(0, 7) === currentMonth)
          .reduce((sum, p) => sum + p.amount, 0);
        const statusThisMonth = currentMonthStatus[m.id] ?? "MONTHLY";
        const unpaidThisMonth = statusThisMonth === "MONTHLY" && paidThisMonth === 0;
        const effectiveBalance = unpaidThisMonth ? balance - currentMonthFee : balance;
        return {
          id: m.id,
          name: m.name,
          status: m.status,
          balance: effectiveBalance,
          hasUnpaidVisitorFee: unpaidVisitorMemberIds.has(m.id),
        };
      });
      // 未払い(月謝の繰越/未払金がマイナス、またはビジター代の未払いが1回でもある)
      // のメンバーを優先し、それ以外は元の並び(ふりがな昇順、listMembers由来)を保つ。
      const isUnpaid = (r: Row) => r.balance < 0 || r.hasUnpaidVisitorFee;
      const sorted = [...computed].sort(
        (a, b) => Number(!isUnpaid(a)) - Number(!isUnpaid(b)),
      );
      setRows(sorted);
      setLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, [db]);

  useFocusEffect(load);

  async function handleAddMember() {
    const trimmed = newName.trim();
    const trimmedFurigana = newFurigana.trim();
    if (!trimmed || !trimmedFurigana) return;
    setAdding(true);
    try {
      await upsertMember(db, { name: trimmed, furigana: trimmedFurigana });
      setNewName("");
      setNewFurigana("");
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
            onChangeText={handleNameChange}
            placeholder="例：山田太郎"
          />
          <AppInput
            testID="new-member-furigana"
            label="ふりがな（カタカナ）"
            value={newFurigana}
            onChangeText={(t) => setNewFurigana(toKatakana(t))}
            placeholder="例：ヤマダタロウ"
          />
          <AppButton
            testID="new-member-submit"
            title={adding ? "追加中..." : "追加する"}
            onPress={handleAddMember}
            disabled={!newName.trim() || !newFurigana.trim() || adding}
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
                      {item.status === "ON_LEAVE" ? (
                        <View testID={`member-leave-badge-${item.id}`}>
                          <Badge label="休会" tone="leave" />
                        </View>
                      ) : null}
                      {item.balance < 0 || item.hasUnpaidVisitorFee ? (
                        <View testID={`member-unpaid-badge-${item.id}`} style={styles.unpaidBadge}>
                          <Text style={styles.unpaidBadgeText}>未払い</Text>
                        </View>
                      ) : null}
                    </View>
                    {item.balance < 0 ? (
                      <Badge label={`未払金 ${formatYen(Math.abs(item.balance))}`} tone="unpaid" />
                    ) : item.hasUnpaidVisitorFee ? (
                      <Badge label="ビジター代未払いあり" tone="unpaid" />
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
