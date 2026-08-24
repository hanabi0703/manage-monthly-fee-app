import React, { useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { colors } from "@/lib/theme";
import { formatDate } from "@/lib/format";

type Props = {
  label: string;
  value: string;
  onChange: (iso: string) => void;
  testID?: string;
};

export function DateField({ label, value, onChange, testID }: Props) {
  const [showPicker, setShowPicker] = useState(false);

  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      {Platform.OS === "web" ? (
        React.createElement("input", {
          type: "date",
          value,
          onChange: (e: { target: { value: string } }) =>
            onChange(e.target.value),
          style: webInputStyle,
          "data-testid": testID,
        })
      ) : (
        <>
          <Pressable
            testID={testID}
            style={styles.button}
            onPress={() => setShowPicker(true)}
          >
            <Text style={styles.buttonText}>{formatDate(value)}</Text>
          </Pressable>
          {showPicker && (
            <DateTimePicker
              value={new Date(`${value}T00:00:00.000Z`)}
              mode="date"
              display="default"
              timeZoneName="Etc/UTC"
              onChange={(_event, selectedDate) => {
                setShowPicker(false);
                if (selectedDate) {
                  onChange(selectedDate.toISOString().slice(0, 10));
                }
              }}
            />
          )}
        </>
      )}
    </View>
  );
}

const webInputStyle: Record<string, string> = {
  fontSize: "15px",
  padding: "10px 12px",
  borderRadius: "8px",
  border: `1px solid ${colors.border}`,
  color: colors.text,
  width: "100%",
  boxSizing: "border-box",
  fontFamily: "inherit",
};

const styles = StyleSheet.create({
  field: { gap: 6 },
  label: { fontSize: 13, fontWeight: "600", color: colors.text },
  button: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: colors.card,
  },
  buttonText: { fontSize: 15, color: colors.text },
});
