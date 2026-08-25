import React from 'react';
import { SafeAreaView, ScrollView, View, Text, StyleSheet } from 'react-native';
import { AppCard } from '../components/AppCard';
import { AppInput } from '../components/AppInput';
import { AppButton } from '../components/AppButton';
import { colors } from '../theme/colors';

export default function MemberDetailScreen() {
  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.header}>メンバー詳細</Text>

        <View style={styles.titleRow}>
          <Text style={styles.title}>てすと1さんのページ</Text>
          <Text style={styles.edit}>編集</Text>
        </View>

        <Text style={styles.sub}>
          支払い履歴と繰越金・未払金の状況です。
        </Text>

        <AppCard style={styles.statusCard}>
          <Text style={styles.statusLabel}>未払金・繰越金</Text>
          <Text style={styles.statusValue}>なし（精算済み）</Text>
        </AppCard>

        <Text style={styles.section}>支払いを記録</Text>

        <AppCard style={styles.form}>
          <AppInput label="参加日" value="2026/08/25(火)" editable={false} />
          <AppInput label="もらった金額" value="3000" keyboardType="number-pad" />
          <AppButton title="登録する" />
        </AppCard>

        <Text style={styles.section}>支払い履歴</Text>
        <AppCard style={styles.empty}>
          <Text style={styles.emptyText}>まだ支払い記録がありません。</Text>
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
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 24, fontWeight: '800', color: colors.text },
  edit: { color: colors.subText, textDecorationLine: 'underline' },
  sub: { marginTop: 8, marginBottom: 18, color: colors.subText },
  statusCard: { marginBottom: 24 },
  statusLabel: { color: colors.subText, fontSize: 14 },
  statusValue: { marginTop: 8, color: colors.text, fontSize: 24, fontWeight: '800' },
  section: { marginVertical: 14, color: colors.green, fontSize: 17, fontWeight: '700' },
  form: { gap: 18 },
  empty: { borderStyle: 'dashed', alignItems: 'center' },
  emptyText: { color: colors.subText },
});
