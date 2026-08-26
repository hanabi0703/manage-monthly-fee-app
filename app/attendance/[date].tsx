import { useCallback, useMemo, useState } from "react";
import {
  Stack,
  useFocusEffect,
  useLocalSearchParams,
  useRouter,
} from "expo-router";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useSQLiteContext } from "expo-sqlite";
import {
  createPaymentForMember,
  deletePayment,
  getFeeAt,
  listMembers,
  listPaymentsForDate,
  type Member,
  type PaymentWithMember,
} from "@/lib/db";
import { formatDate, formatYen } from "@/lib/format";
import { colors } from "@/lib/theme";
import { EmptyState, Screen } from "@/components/ui";
import { AppButton } from "@/components/AppButton";
import { AppCheckbox } from "@/components/AppCheckbox";

type RowState = { checked: boolean; isVisitor: boolean };

export default function AttendanceScreen() {
  const { date } = useLocalSearchParams<{ date: string }>();
  const db = useSQLiteContext();
  const router = useRouter();

  const [members, setMembers] = useState<Member[]>([]);
  const [existing, setExisting] = useState<PaymentWithMember[]>([]);
  const [fee, setFee] = useState(0);
  const [rows, setRows] = useState<Record<string, RowState>>({});
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (!date) return;
      let cancelled = false;
      Promise.all([listMembers(db), listPaymentsForDate(db, date), getFeeAt(db, date)]).then(
        ([m, payments, standardFee]) => {
          if (cancelled) return;
          const initial: Record<string, RowState> = {};
          for (const member of m) {
            const payment = payments.find((p) => p.memberId === member.id);
            initial[member.id] = {
              checked: !!payment,
              isVisitor: payment?.type === "VISITOR",
            };
          }
          setMembers(m);
          setExisting(payments);
          setFee(standardFee);
          setRows(initial);
          setLoaded(true);
        },
      );
      return () => {
        cancelled = true;
      };
    }, [db, date]),
  );

  const checkedCount = useMemo(
    () => Object.values(rows).filter((r) => r.checked).length,
    [rows],
  );

  function toggleChecked(memberId: string) {
    setRows((prev) => ({
      ...prev,
      [memberId]: {
        checked: !(prev[memberId]?.checked ?? false),
        isVisitor: prev[memberId]?.isVisitor ?? false,
      },
    }));
  }

  function toggleVisitor(memberId: string) {
    setRows((prev) => ({
      ...prev,
      [memberId]: {
        checked: prev[memberId]?.checked ?? false,
        isVisitor: !(prev[memberId]?.isVisitor ?? false),
      },
    }));
  }

  async function handleSave() {
    if (!date) return;
    setSaving(true);
    try {
      const ops: Promise<void>[] = [];
      for (const member of members) {
        const state = rows[member.id] ?? { checked: false, isVisitor: false };
        const currentPayment = existing.find((p) => p.memberId === member.id);
        const desiredType = state.isVisitor ? "VISITOR" : "MONTHLY";

        if (state.checked) {
          if (!currentPayment) {
            ops.push(
              createPaymentForMember(db, {
                memberId: member.id,
                date,
                amount: fee,
                type: desiredType,
              }),
            );
          } else if (currentPayment.type !== desiredType) {
            ops.push(
              deletePayment(db, currentPayment.id).then(() =>
                createPaymentForMember(db, {
                  memberId: member.id,
                  date,
                  amount: fee,
                  type: desiredType,
                }),
              ),
            );
          }
        } else if (currentPayment) {
          ops.push(deletePayment(db, currentPayment.id));
        }
      }
      await Promise.all(ops);
      router.back();
    } finally {
      setSaving(false);
    }
  }

  if (!loaded) return null;

  return (
    <Screen>
      <Stack.Screen
        options={{ title: date ? `${formatDate(date)} 出欠` : "出欠確認" }}
      />
      <FlatList
        contentContainerStyle={styles.wrap}
        data={members}
        keyExtractor={(m) => m.id}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.title}>{date ? formatDate(date) : ""}</Text>
            <Text style={styles.subtitle}>
              チェックした人は月謝 {formatYen(fee)}
              として記録されます。ビジターとして参加した人は「ビジター」を選んでください。
            </Text>
            <Text style={styles.countText}>{checkedCount}人 選択中</Text>
            {members.length === 0 ? (
              <EmptyState>
                まだメンバーが登録されていません。「メンバー」タブから追加してください。
              </EmptyState>
            ) : null}
          </View>
        }
        renderItem={({ item }) => {
          const state = rows[item.id] ?? { checked: false, isVisitor: false };
          return (
            <Pressable
              testID={`attendance-row-${item.id}`}
              style={styles.row}
              onPress={() => toggleChecked(item.id)}
            >
              <View style={styles.rowLeft}>
                <AppCheckbox
                  testID={`attendance-checkbox-${item.id}`}
                  checked={state.checked}
                  onToggle={() => toggleChecked(item.id)}
                />
                <Text style={styles.name}>{item.name}</Text>
              </View>
              {state.checked ? (
                <Pressable
                  testID={`attendance-visitor-${item.id}`}
                  style={[styles.visitorChip, state.isVisitor && styles.visitorChipActive]}
                  onPress={() => toggleVisitor(item.id)}
                  hitSlop={8}
                >
                  <Text
                    style={[
                      styles.visitorChipText,
                      state.isVisitor && styles.visitorChipTextActive,
                    ]}
                  >
                    {state.isVisitor ? "ビジター" : "月謝"}
                  </Text>
                </Pressable>
              ) : (
                <Text style={styles.dash}>-</Text>
              )}
            </Pressable>
          );
        }}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListFooterComponent={
          members.length > 0 ? (
            <View style={styles.footer}>
              <AppButton
                testID="attendance-save"
                title={saving ? "保存中..." : "保存する"}
                onPress={handleSave}
                disabled={saving}
              />
            </View>
          ) : null
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 20, paddingBottom: 48 },
  header: { gap: 8, marginBottom: 8 },
  title: { fontSize: 22, fontWeight: "800", color: colors.text },
  subtitle: { fontSize: 13, color: colors.textMuted, lineHeight: 19 },
  countText: { fontSize: 13, color: colors.green, fontWeight: "700", marginTop: 2 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    minHeight: 54,
  },
  rowLeft: { flexDirection: "row", alignItems: "center", gap: 14 },
  name: { fontSize: 16, fontWeight: "700", color: colors.text },
  dash: { color: colors.disabled, fontSize: 14 },
  visitorChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: colors.monthlyBg,
  },
  visitorChipActive: {
    backgroundColor: colors.visitorBg,
    borderColor: colors.visitorText,
  },
  visitorChipText: { fontSize: 12, fontWeight: "700", color: colors.monthlyText },
  visitorChipTextActive: { color: colors.visitorText },
  separator: { height: 10 },
  footer: { marginTop: 16 },
});
