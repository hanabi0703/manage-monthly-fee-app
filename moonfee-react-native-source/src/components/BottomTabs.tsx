import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { DoodleIcon } from './DoodleIcon';
import { colors } from '../theme/colors';

type Tab = 'accounting' | 'input' | 'members' | 'settings';

type Props = {
  active: Tab;
  onChange: (tab: Tab) => void;
};

const items: { key: Tab; label: string; icon: Tab }[] = [
  { key: 'accounting', label: '会計表', icon: 'accounting' },
  { key: 'input', label: '入力', icon: 'input' as any },
  { key: 'members', label: 'メンバー', icon: 'members' },
  { key: 'settings', label: '設定', icon: 'settings' },
];

export function BottomTabs({ active, onChange }: Props) {
  return (
    <View style={styles.container}>
      {items.map((item) => {
        const selected = item.key === active;
        const iconName = item.key === 'input' ? 'pencil' : item.icon;
        return (
          <Pressable key={item.key} style={styles.item} onPress={() => onChange(item.key)}>
            <DoodleIcon
              name={iconName as any}
              size={25}
              color={selected ? colors.green : '#8F847A'}
            />
            <Text style={[styles.label, selected && styles.activeLabel]}>
              {item.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: '#FFF',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 10,
    paddingBottom: 8,
  },
  item: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  label: {
    fontSize: 12,
    color: '#8F847A',
  },
  activeLabel: {
    color: colors.green,
    fontWeight: '700',
  },
});
