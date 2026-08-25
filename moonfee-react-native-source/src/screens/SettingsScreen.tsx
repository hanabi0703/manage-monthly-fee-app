import React from 'react';
import { SafeAreaView, ScrollView, View, Text, StyleSheet } from 'react-native';
import { AppCard } from '../components/AppCard';
import { AppInput } from '../components/AppInput';
import { AppButton } from '../components/AppButton';
import { colors } from '../theme/colors';

export default function SettingsScreen() {
  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.header}>設定</Text>
        <Text style={styles.title}>設定</Text>
        <Text style={styles.sub}>
          月謝額と、月ごとの練習日を管理します。
        </Text>

        <Text style={styles.section}>月謝設定</Text>
        <AppCard style={styles.form}>
          <AppInput label="月謝額" value="5000" />
          <AppInput label="適用開始日" value="2026/08/25(火)" editable={false} />
          <AppButton title="追加する" />
        </AppCard>

        <View style={styles.history}>
          <AppCard style={styles.historyCard}>
            <Text style={styles.price}>¥5,000</Text>
            <Text style={styles.date}>2026/08/24(月)〜</Text>
          </AppCard>
          <AppCard style={styles.historyCard}>
            <Text style={styles.price}>¥3,000</Text>
            <Text style={styles.date}>2026/08/24(月)〜</Text>
          </AppCard>
        </View>

        <Text style={styles.section}>練習日設定</Text>
        <AppCard>
          <Text style={styles.month}>2026年08月</Text>
          {['2026/08/01(土)', '2026/08/22(土)', '2026/08/29(土)'].map((d) => (
            <View key={d} style={styles.dateRow}>
              <Text style={styles.dateText}>{d}</Text>
              <Text style={styles.delete}>削除</Text>
            </View>
          ))}
        </AppCard>
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
  sub: { marginTop: 6, marginBottom: 24, color: colors.subText },
  section: { marginBottom: 12, fontSize: 17, fontWeight: '700', color: colors.green },
  form: { gap: 18 },
  history: { gap: 10, marginVertical: 14 },
  historyCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14 },
  price: { fontSize: 18, fontWeight: '800', color: colors.text },
  date: { color: colors.subText },
  month: { textAlign: 'center', fontSize: 20, fontWeight: '800', color: colors.text, marginBottom: 16 },
  dateRow: {
    minHeight: 54,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    paddingHorizontal: 14,
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dateText: { color: colors.text, fontWeight: '700' },
  delete: { color: colors.coral, fontSize: 13 },
});
