import React, { useCallback, useEffect, useState } from "react";
import { Alert, FlatList, RefreshControl, StyleSheet, Text, View } from "react-native";
import { ModelCard } from "../components/ModelCard";
import { colors, spacing } from "../theme/colors";
import { modelsApi } from "../api/models";
import { useSettingsStore } from "../state/useSettingsStore";
import { ModelInfo } from "../api/types";

export function ModelsScreen() {
  const serial = useSettingsStore((s) => s.activeDeviceSerial);
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setModels(await modelsApi.list(serial));
  }, [serial]);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const push = async (filename: string) => {
    try {
      await modelsApi.push(filename, serial);
      await load();
    } catch (err) {
      Alert.alert("Push failed", String(err));
    }
  };

  const remove = async (filename: string) => {
    try {
      await modelsApi.delete(filename, true, serial);
      await load();
    } catch (err) {
      Alert.alert("Delete failed", String(err));
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Models</Text>
      <Text style={styles.subtitle}>Drop .gguf files into backend/workspace/models to see them here.</Text>
      <FlatList
        data={models}
        keyExtractor={(item) => item.filename}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.textPrimary} />}
        renderItem={({ item }) => (
          <ModelCard model={item} onPush={() => push(item.filename)} onDelete={() => remove(item.filename)} />
        )}
        ListEmptyComponent={<Text style={styles.empty}>No local .gguf models found.</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  title: { color: colors.textPrimary, fontSize: 20, fontWeight: "700", padding: spacing.md, paddingBottom: 0 },
  subtitle: { color: colors.textSecondary, fontSize: 12, paddingHorizontal: spacing.md, marginBottom: spacing.sm },
  list: { paddingHorizontal: spacing.md, paddingBottom: spacing.lg },
  empty: { color: colors.textSecondary, textAlign: "center", marginTop: spacing.lg },
});
