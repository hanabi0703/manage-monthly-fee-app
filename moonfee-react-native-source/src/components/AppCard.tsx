import React from 'react';
import { View, ViewProps, StyleSheet } from 'react-native';
import { colors } from '../theme/colors';

type Props = ViewProps & {
  children: React.ReactNode;
};

export function AppCard({ children, style, ...props }: Props) {
  return (
    <View {...props} style={[styles.card, style]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 18,
    shadowColor: '#000',
    shadowOpacity: 0.025,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 1,
  },
});
