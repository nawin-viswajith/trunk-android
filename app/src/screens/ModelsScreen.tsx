import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, FlatList, RefreshControl, StyleSheet, Text, View } from "react-native";
import { Button } from "../components/Button";
import { ModelCard } from "../components/ModelCard";
import { ColorPalette, spacing } from "../theme/colors";
import { useColors } from "../theme/ThemeContext";
import { deleteLocalModel, getTotalStorageUsed, importModelFromDevice, listLocalModels, LocalModel } from "../services/modelStorage";
import { formatBytes } from "../utils/format";

export function ModelsScreen({ navigation }: any) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [models, setModels] = useState<LocalModel[]>([]);
  const [totalUsed, setTotalUsed] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [importing, setImporting] = useState(false);

  const load = useCallback(async () => {
    setModels(await listLocalModels());
    setTotalUsed(await getTotalStorageUsed());
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const unsubscribe = navigation.addListener("focus", load);
    return unsubscribe;
  }, [navigation, load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const remove = (filename: string) => {
    Alert.alert("Delete model", `Delete ${filename}? This cannot be undone.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          await deleteLocalModel(filename);
          await load();
        },
      },
    ]);
  };

  const importModel = async () => {
    setImporting(true);
    try {
      const imported = await importModelFromDevice();
      if (imported) await load();
    } catch (err) {
      Alert.alert("Import failed", String(err));
    } finally {
      setImporting(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Models</Text>
        <Text style={styles.subtitle}>{models.length} downloaded -- {formatBytes(totalUsed)} used</Text>
        <View style={styles.headerActions}>
          <Button label="Import from Device" variant="secondary" onPress={importModel} loading={importing} />
          <Button label="Browse Hugging Face" variant="secondary" onPress={() => navigation.navigate("Browse Hugging Face")} />
        </View>
      </View>
      <FlatList
        data={models}
        keyExtractor={(item) => item.filename}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.textPrimary} />}
        renderItem={({ item }) => <ModelCard model={item} onDelete={() => remove(item.filename)} />}
        ListEmptyComponent={<Text style={styles.empty}>No models downloaded yet -- browse Hugging Face to get one.</Text>}
      />
    </View>
  );
}

function createStyles(colors: ColorPalette) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: { padding: spacing.md, paddingBottom: spacing.sm },
    title: { color: colors.textPrimary, fontSize: 20, fontWeight: "700" },
    subtitle: { color: colors.textSecondary, fontSize: 12, marginTop: spacing.xs, marginBottom: spacing.sm },
    headerActions: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
    list: { paddingHorizontal: spacing.md, paddingBottom: spacing.lg },
    empty: { color: colors.textSecondary, textAlign: "center", marginTop: spacing.lg },
  });
}
