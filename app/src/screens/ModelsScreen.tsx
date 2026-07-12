import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, FlatList, RefreshControl, StyleSheet, Text, View } from "react-native";
import { Button } from "../components/Button";
import { ModelCard } from "../components/ModelCard";
import { ColorPalette, spacing } from "../theme/colors";
import { useColors } from "../theme/ThemeContext";
import { modelsApi } from "../api/models";
import { useSettingsStore } from "../state/useSettingsStore";
import { ModelInfo } from "../api/types";

export function ModelsScreen({ navigation }: any) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
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
      <View style={styles.headerRow}>
        <View style={styles.headerText}>
          <Text style={styles.title}>Models</Text>
          <Text style={styles.subtitle}>Drop .gguf files into backend/workspace/models to see them here.</Text>
        </View>
        <Button label="Browse Hugging Face" variant="secondary" onPress={() => navigation.navigate("Browse Hugging Face")} />
      </View>
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

function createStyles(colors: ColorPalette) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    headerRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      justifyContent: "space-between",
      padding: spacing.md,
      paddingBottom: spacing.sm,
      gap: spacing.sm,
    },
    headerText: { flexShrink: 1 },
    title: { color: colors.textPrimary, fontSize: 20, fontWeight: "700" },
    subtitle: { color: colors.textSecondary, fontSize: 12, marginTop: spacing.xs },
    list: { paddingHorizontal: spacing.md, paddingBottom: spacing.lg },
    empty: { color: colors.textSecondary, textAlign: "center", marginTop: spacing.lg },
  });
}
