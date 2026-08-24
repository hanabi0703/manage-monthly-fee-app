import { useEffect, useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Alert, StyleSheet, Text, TextInput, View } from "react-native";
import { useSQLiteContext } from "expo-sqlite";
import { getMember, updateMemberName } from "@/lib/db";
import { colors } from "@/lib/theme";
import { Card, PrimaryButton, Screen, ScreenTitle } from "@/components/ui";

export default function EditMemberScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const db = useSQLiteContext();
  const router = useRouter();
  const [name, setName] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!id) return;
    getMember(db, id).then((m) => {
      setName(m?.name ?? "");
      setLoaded(true);
    });
  }, [db, id]);

  async function handleSave() {
    if (!id || !name.trim()) return;
    setSubmitting(true);
    try {
      await updateMemberName(db, id, name.trim());
      router.back();
    } catch {
      Alert.alert("保存できませんでした", "この名前はすでに使われている可能性があります。");
    } finally {
      setSubmitting(false);
    }
  }

  if (!loaded) return null;

  return (
    <Screen>
      <ScreenTitle title="メンバー編集" />
      <View style={styles.wrap}>
        <Card style={styles.form}>
          <View style={styles.field}>
            <Text style={styles.label}>名前</Text>
            <TextInput
              testID="edit-member-name"
              value={name}
              onChangeText={setName}
              style={styles.input}
              placeholder="例: 山田太郎"
              placeholderTextColor={colors.textFaint}
            />
          </View>
          <PrimaryButton
            testID="edit-member-submit"
            label={submitting ? "保存中..." : "保存する"}
            onPress={handleSave}
            disabled={!name.trim() || submitting}
          />
        </Card>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 16 },
  form: { gap: 14 },
  field: { gap: 6 },
  label: { fontSize: 13, fontWeight: "600", color: colors.text },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    fontSize: 15,
    color: colors.text,
    backgroundColor: colors.card,
  },
});
