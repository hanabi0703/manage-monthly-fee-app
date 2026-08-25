import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  SafeAreaView,
} from 'react-native';
import { AppCard } from '../components/AppCard';
import { AppInput } from '../components/AppInput';
import { AppButton } from '../components/AppButton';
import { DoodleIcon } from '../components/DoodleIcon';
import { colors } from '../theme/colors';

export default function PaymentInputScreen() {
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('3000');
  const [type, setType] = useState<'monthly' | 'visitor'>('monthly');

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>入力</Text>
          <DoodleIcon name="pencil" size={22} />
        </View>

        <Text style={styles.title}>支払いを記録</Text>
        <Text style={styles.currentPrice}>
          現在の月謝額：<Text style={styles.green}>¥3,000</Text>
        </Text>

        <AppCard style={styles.formCard}>
          <AppInput
            label="メンバーの名前"
            placeholder="例：山田太郎"
            value={name}
            onChangeText={setName}
          />

          <Text style={styles.help}>
            新しい名前を入力すると自動的にメンバーが追加されます。
          </Text>

          <AppInput label="日付" value="2026/08/25 (火)" editable={false} />

          <AppInput
            label="もらった金額"
            keyboardType="number-pad"
            value={amount}
            onChangeText={setAmount}
          />

          <View style={styles.typeContainer}>
            <Text style={styles.label}>区分</Text>
            <View style={styles.typeRow}>
              <Pressable
                style={[styles.typeButton, type === 'monthly' && styles.typeSelected]}
                onPress={() => setType('monthly')}
              >
                <Text style={[styles.typeText, type === 'monthly' && styles.typeSelectedText]}>
                  月謝
                </Text>
              </Pressable>

              <Pressable
                style={[styles.typeButton, type === 'visitor' && styles.typeSelected]}
                onPress={() => setType('visitor')}
              >
                <Text style={[styles.typeText, type === 'visitor' && styles.typeSelectedText]}>
                  ビジター
                </Text>
              </Pressable>
            </View>
          </View>

          <AppButton title="登録する" disabled={!name} />
        </AppCard>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  container: { padding: 20, paddingBottom: 120 },
  header: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginBottom: 32,
  },
  headerTitle: { fontSize: 21, fontWeight: '700', color: colors.text },
  title: { fontSize: 25, fontWeight: '800', color: colors.text, marginBottom: 6 },
  currentPrice: { fontSize: 15, color: colors.subText, marginBottom: 22 },
  green: { color: colors.green, fontWeight: '700' },
  formCard: { gap: 20 },
  help: { marginTop: -10, color: colors.subText, fontSize: 12, lineHeight: 18 },
  typeContainer: { gap: 8 },
  label: { fontSize: 15, fontWeight: '700', color: colors.text },
  typeRow: { flexDirection: 'row', gap: 10 },
  typeButton: {
    flex: 1,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: '#FFFFFF',
  },
  typeSelected: {
    backgroundColor: colors.green,
    borderColor: colors.green,
  },
  typeText: { color: colors.text, fontSize: 15, fontWeight: '700' },
  typeSelectedText: { color: '#FFFFFF' },
});
