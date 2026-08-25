import React from 'react';
import { Pressable, Text, StyleSheet } from 'react-native';
import { colors } from '../theme/colors';

type Props = {
  title: string;
  onPress?: () => void;
  disabled?: boolean;
  variant?: 'coral' | 'green' | 'outline';
};

export function AppButton({
  title,
  onPress,
  disabled = false,
  variant = 'coral',
}: Props) {
  const backgroundColor =
    variant === 'coral'
      ? colors.coral
      : variant === 'green'
      ? colors.green
      : '#FFFFFF';

  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.button,
        { backgroundColor: disabled ? colors.disabled : backgroundColor },
        variant === 'outline' && styles.outline,
      ]}
    >
      <Text style={[styles.text, variant === 'outline' && styles.outlineText]}>
        {title}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    height: 54,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 15,
  },
  outline: {
    borderWidth: 1,
    borderColor: colors.border,
  },
  text: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  outlineText: {
    color: colors.text,
  },
});
