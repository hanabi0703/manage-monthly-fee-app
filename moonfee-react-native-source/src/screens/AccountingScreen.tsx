import React from 'react';
import { SafeAreaView, ScrollView, View, Text, StyleSheet } from 'react-native';
import { AppCard } from '../components/AppCard';
import { colors } from '../theme/colors';

const rows = [
  ['てすと1', '-', '-', '-'],
  ['てすと3', '-', '-', '¥1,000'],
  ['テスト2', '-', '-', '-'],
];

export default function AccountingScreen() {
  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.header}>会計表</Text>
        <Text style={styles.title}>会計表</Text>
        <Text style={styles.sub}>月ごとに、練習日 × メンバーの支払い状況を確認できます。</Text>

        <AppCard style={styles.summary}>
          <Text style={styles.month}>2026年08月</Text>
          <Text style={styles.summaryText}>練習日 3日 ・ 集金 ¥1,000</Text>
        </AppCard>

        <View style={styles.table}>
          <View style={[styles.row, styles.headRow]}>
            {['メンバー', '08/01(土)', '08/22(土)', '08/29(土)'].map((v) => (
              <Text key={v} style={[styles.cell, styles.headCell]}>{v}</Text>
            ))}
          </View>

          {rows.map((row, i) => (
            <View key={i} style={styles.row}>
              {row.map((v, j) => (
                <View key={j} style={styles.cellWrap}>
                  <Text style={[styles.cell, j === 0 && styles.nameCell, v.includes('¥') && styles.amount]}>
                    {v}
                  </Text>
                </View>
              ))}
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  container: { padding: 20, paddingBottom: 120 },
  header: {
    textAlign: 'center',
    fontSize: 21,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 28,
  },
  title: { fontSize: 25, fontWeight: '800', color: colors.text },
  sub: { marginTop: 6, marginBottom: 18, color: colors.subText },
  summary: { marginBottom: 14 },
  month: { fontSize: 22, fontWeight: '800', color: colors.text },
  summaryText: { marginTop: 8, color: colors.subText, fontSize: 15 },
  table: { borderWidth: 1, borderColor: colors.border, borderRadius: 16, overflow: 'hidden' },
  row: { flexDirection: 'row', minHeight: 58, borderTopWidth: 1, borderTopColor: colors.border },
  headRow: { borderTopWidth: 0, backgroundColor: '#F8F5F1' },
  cellWrap: { flex: 1, justifyContent: 'center', borderLeftWidth: 1, borderLeftColor: colors.border },
  cell: { flex: 1, padding: 10, fontSize: 12, color: colors.subText },
  headCell: { fontWeight: '700', color: colors.subText },
  nameCell: { color: colors.text, fontWeight: '700' },
  amount: {
    color: '#C26A33',
    backgroundColor: colors.yellowLight,
    borderRadius: 999,
    overflow: 'hidden',
  },
});
