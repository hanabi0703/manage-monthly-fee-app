import React from 'react';
import { View, Text, TextInput, TextInputProps, StyleSheet } from 'react-native';
import { colors } from '../theme/colors';

type Props = TextInputProps & {
  label: string;
};

export function AppInput({ label, style, ...props }: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        {...props}
        placeholderTextColor="#B8AEA5"
        style={[styles.input, style]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 8 },
  label: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  input: {
    minHeight: 54,
    paddingHorizontal: 16,
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    fontSize: 17,
    color: colors.text,
  },
});
