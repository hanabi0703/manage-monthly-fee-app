import React from 'react';
import { SafeAreaView, ScrollView, View, Text, Pressable, StyleSheet } from 'react-native';
import { AppCard } from '../components/AppCard';
import { colors } from '../theme/colors';

const members = [
  { id: '1', name: 'てすと1', status: '精算済み' },
  { id: '2', name: 'てすと3', status: '精算済み' },
  { id: '3', name: 'テスト2', status: '精算済み' },
];

export default function MembersScreen() {
  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.header}>メンバー</Text>
        <Text style={styles.title}>メンバー一覧</Text>
        <Text style={styles.sub}>繰越金・未払金の状況を確認できます。</Text>

        <View style={styles.list}>
          {members.map((member) => (
            <Pressable key={member.id}>
              <AppCard style={styles.card}>
                <View>
                  <Text style={styles.name}>{member.name}</Text>
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{member.status}</Text>
                  </View>
                </View>
                <Text style={styles.chevron}>›</Text>
              </AppCard>
            </Pressable>
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
  sub: { marginTop: 6, marginBottom: 18, color: colors.subText, fontSize: 14 },
  list: { gap: 12 },
  card: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  name: { fontSize: 19, fontWeight: '700', color: colors.text, marginBottom: 10 },
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: colors.greenLight,
  },
  badgeText: { color: colors.green, fontWeight: '700', fontSize: 12 },
  chevron: { fontSize: 28, color: colors.subText },
});
