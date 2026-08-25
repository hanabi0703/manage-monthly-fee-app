import { useEffect, useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Alert, StyleSheet, View } from "react-native";
import { useSQLiteContext } from "expo-sqlite";
import { getMember, updateMemberName } from "@/lib/db";
import { Screen, ScreenTitle } from "@/components/ui";
import { AppCard } from "@/components/AppCard";
import { AppButton } from "@/components/AppButton";
import { AppInput } from "@/components/AppInput";

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
        <AppCard style={styles.form}>
          <AppInput
            testID="edit-member-name"
            label="名前"
            value={name}
            onChangeText={setName}
            placeholder="例：山田太郎"
          />
          <AppButton
            testID="edit-member-submit"
            title={submitting ? "保存中..." : "保存する"}
            onPress={handleSave}
            disabled={!name.trim() || submitting}
          />
        </AppCard>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 20 },
  form: { gap: 20 },
});
