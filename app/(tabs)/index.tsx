import { useCallback, useState } from "react";
import { useFocusEffect, useRouter } from "expo-router";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useSQLiteContext } from "expo-sqlite";
import { listPayments, type PaymentWithMember } from "@/lib/db";
import { formatDate, formatYen } from "@/lib/format";
import { colors } from "@/lib/theme";
import { EmptyState, Screen, ScreenTitle } from "@/components/ui";

const DATE_COL_WIDTH = 108;
const MEMBER_COL_WIDTH = 128;

export default function DashboardScreen() {
  const db = useSQLiteContext();
  const router = useRouter();
  const [payments, setPayments] = useState<PaymentWithMember[]>([]);
  const [loaded, setLoaded] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      listPayments(db).then((rows) => {
        if (!cancelled) {
          setPayments(rows);
          setLoaded(true);
        }
      });
      return () => {
        cancelled = true;
      };
    }, [db]),
  );

  const dateKeys = Array.from(new Set(payments.map((p) => p.date))).sort(
    (a, b) => b.localeCompare(a),
  );
  const members = Array.from(
    new Map(payments.map((p) => [p.memberId, p.memberName])).entries(),
  ).sort((a, b) => a[1].localeCompare(b[1], "ja"));

  const cellMap = new Map<string, PaymentWithMember[]>();
  for (const p of payments) {
    const key = `${p.date}__${p.memberId}`;
    const list = cellMap.get(key) ?? [];
    list.push(p);
    cellMap.set(key, list);
  }

  return (
    <Screen>
      <ScreenTitle
        title="会計表"
        subtitle="日付ごとに、誰が月謝・ビジター料金を払ったか一覧できます。"
      />
      {loaded && (dateKeys.length === 0 || members.length === 0) ? (
        <View style={styles.emptyWrap}>
          <EmptyState>
            まだ記録がありません。「入力」タブから登録してください。
          </EmptyState>
        </View>
      ) : (
        <ScrollView style={styles.verticalScroll}>
          <ScrollView horizontal>
            <View style={styles.table}>
              <View style={styles.headerRow}>
                <View style={[styles.cell, styles.dateCol, styles.headerCell]}>
                  <Text style={styles.headerText}>日付</Text>
                </View>
                {members.map(([id, name]) => (
                  <View
                    key={id}
                    style={[styles.cell, styles.memberCol, styles.headerCell]}
                  >
                    <Text
                      style={styles.headerLink}
                      onPress={() => router.push(`/members/${id}`)}
                      numberOfLines={1}
                    >
                      {name}
                    </Text>
                  </View>
                ))}
              </View>
              {dateKeys.map((dateKey, idx) => (
                <View
                  key={dateKey}
                  style={[
                    styles.row,
                    idx % 2 === 1 && { backgroundColor: "#f8fafc" },
                  ]}
                >
                  <View style={[styles.cell, styles.dateCol]}>
                    <Text style={styles.dateText}>{formatDate(dateKey)}</Text>
                  </View>
                  {members.map(([id]) => {
                    const cell = cellMap.get(`${dateKey}__${id}`) ?? [];
                    return (
                      <View key={id} style={[styles.cell, styles.memberCol]}>
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
                                {p.type === "MONTHLY" ? "✓ 月謝" : "V ビジター"}{" "}
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
  verticalScroll: {
    marginTop: 8,
  },
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
    paddingHorizontal: 10,
    borderRightWidth: 1,
    borderColor: colors.border,
    justifyContent: "center",
    gap: 4,
  },
  headerCell: {
    paddingVertical: 10,
  },
  dateCol: { width: DATE_COL_WIDTH },
  memberCol: { width: MEMBER_COL_WIDTH },
  headerText: {
    fontWeight: "600",
    color: colors.textMuted,
    fontSize: 13,
  },
  headerLink: {
    fontWeight: "600",
    color: colors.text,
    fontSize: 13,
  },
  dateText: {
    fontWeight: "600",
    color: colors.text,
    fontSize: 13,
  },
  dash: {
    color: colors.textFaint,
  },
  chip: {
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  chipText: {
    fontSize: 11,
    fontWeight: "600",
  },
});
