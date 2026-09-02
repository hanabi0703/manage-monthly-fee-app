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
          <Pressable style={styles.button} onPress={() => setShowPicker(true)}>
            <Text style={styles.buttonText}>{formatDate(value)}</Text>
          </Pressable>
          {showPicker && (
            <DateTimePicker
              value={new Date(`${value}T00:00:00.000Z`)}
              mode="date"
              display={Platform.OS === "ios" ? "inline" : "default"}
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
  fontSize: "17px",
  height: "54px",
  padding: "0 16px",
  borderRadius: "14px",
  border: `1px solid ${colors.border}`,
  color: colors.text,
  width: "100%",
  boxSizing: "border-box",
  fontFamily: "inherit",
  backgroundColor: "#FFFFFF",
};

const styles = StyleSheet.create({
  field: { gap: 8 },
  label: { fontSize: 15, fontWeight: "700", color: colors.text },
  button: {
    minHeight: 54,
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    paddingHorizontal: 16,
    backgroundColor: colors.card,
  },
  buttonText: { fontSize: 17, color: colors.text },
});
