import { useCallback, useState } from "react";
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useSQLiteContext } from "expo-sqlite";
import {
  listMembers,
  listPayments,
  listPracticeDaysForMonth,
  type Member,
  type PaymentWithMember,
} from "@/lib/db";
import { formatMonthLabel, formatShortDate, formatYen } from "@/lib/format";
import { colors } from "@/lib/theme";
import { EmptyState, Screen } from "@/components/ui";

const MEMBER_COL_WIDTH = 112;
const DATE_COL_WIDTH = 84;

export default function MonthAccountingScreen() {
  const { month } = useLocalSearchParams<{ month: string }>();
  const db = useSQLiteContext();
  const router = useRouter();
  const [members, setMembers] = useState<Member[]>([]);
  const [payments, setPayments] = useState<PaymentWithMember[]>([]);
  const [dateKeys, setDateKeys] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (!month) return;
      let cancelled = false;
      Promise.all([
        listMembers(db),
        listPayments(db),
        listPracticeDaysForMonth(db, month),
      ]).then(([m, allPayments, practiceDays]) => {
        if (cancelled) return;
        const monthPayments = allPayments.filter((p) => p.date.slice(0, 7) === month);
        const dates = Array.from(
          new Set([
            ...practiceDays.map((d) => d.date),
            ...monthPayments.map((p) => p.date),
          ]),
        ).sort((a, b) => a.localeCompare(b));
        setMembers(m);
        setPayments(monthPayments);
        setDateKeys(dates);
        setLoaded(true);
      });
      return () => {
        cancelled = true;
      };
    }, [db, month]),
  );

  const cellMap = new Map<string, PaymentWithMember[]>();
  for (const p of payments) {
    const key = `${p.memberId}__${p.date}`;
    const list = cellMap.get(key) ?? [];
    list.push(p);
    cellMap.set(key, list);
  }

  return (
    <Screen>
      <Stack.Screen
        options={{ title: month ? formatMonthLabel(month) : "会計表" }}
      />
      {loaded && (dateKeys.length === 0 || members.length === 0) ? (
        <View style={styles.emptyWrap}>
          <EmptyState>
            {members.length === 0
              ? "まだメンバーが登録されていません。"
              : "この月の練習日が登録されていません。「設定」タブで登録してください。"}
          </EmptyState>
        </View>
      ) : (
        <ScrollView style={styles.verticalScroll}>
          <ScrollView horizontal>
            <View style={styles.table}>
              <View style={styles.headerRow}>
                <View style={[styles.cell, styles.memberCol, styles.headerCell]}>
                  <Text style={styles.headerText}>メンバー</Text>
                </View>
                {dateKeys.map((d) => (
                  <View
                    key={d}
                    style={[styles.cell, styles.dateCol, styles.headerCell]}
                  >
                    <Text style={styles.headerText}>{formatShortDate(d)}</Text>
                  </View>
                ))}
              </View>
              {members.map((m, idx) => (
                <View
                  key={m.id}
                  style={[styles.row, idx % 2 === 1 && { backgroundColor: "#f8fafc" }]}
                >
                  <View style={[styles.cell, styles.memberCol]}>
                    <Text
                      style={styles.memberLink}
                      onPress={() => router.push(`/members/${m.id}`)}
                      numberOfLines={1}
                    >
                      {m.name}
                    </Text>
                  </View>
                  {dateKeys.map((d) => {
                    const cell = cellMap.get(`${m.id}__${d}`) ?? [];
                    return (
                      <View key={d} style={[styles.cell, styles.dateCol]}>
                        {cell.length === 0 ? (
                          <Text style={styles.dash}>-</Text>
                        ) : (
                          cell.map((p) => (
                            <View
                              key={p.id}
                              style={[
                                styles.chip,
                                {
                                  backgroundColor:
                                    p.type === "MONTHLY"
                                      ? colors.monthlyBg
                                      : colors.visitorBg,
                                },
                              ]}
                            >
                              <Text
                                style={[
                                  styles.chipText,
                                  {
                                    color:
                                      p.type === "MONTHLY"
                                        ? colors.monthlyText
                                        : colors.visitorText,
                                  },
                                ]}
                              >
                                {p.type === "MONTHLY" ? "✓" : "V"}{" "}
                                {formatYen(p.amount)}
                              </Text>
                            </View>
                          ))
                        )}
                      </View>
                    );
                  })}
                </View>
              ))}
            </View>
          </ScrollView>
        </ScrollView>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  emptyWrap: { padding: 16 },
  verticalScroll: { marginTop: 8 },
  table: {
    borderTopWidth: 1,
    borderColor: colors.border,
    paddingBottom: 24,
  },
  headerRow: {
    flexDirection: "row",
    backgroundColor: colors.neutralBg,
  },
  row: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  cell: {
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRightWidth: 1,
    borderColor: colors.border,
    justifyContent: "center",
    gap: 4,
  },
  headerCell: { paddingVertical: 10 },
  memberCol: { width: MEMBER_COL_WIDTH },
  dateCol: { width: DATE_COL_WIDTH },
  headerText: {
    fontWeight: "600",
    color: colors.textMuted,
    fontSize: 12,
  },
  memberLink: {
    fontWeight: "600",
    color: colors.text,
    fontSize: 13,
  },
  dash: { color: colors.textFaint },
  chip: {
    borderRadius: 6,
    paddingHorizontal: 5,
    paddingVertical: 3,
  },
  chipText: {
    fontSize: 10,
    fontWeight: "600",
  },
});
