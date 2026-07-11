import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, FlatList, Pressable, RefreshControl, StyleSheet, Text, TextInput, View } from "react-native";
import { ConfirmModal } from "../components/ConfirmModal";
import { IndeterminateProgressBar } from "../components/IndeterminateProgressBar";
import { ModelCard } from "../components/ModelCard";
import { ModelInfoModal } from "../components/ModelInfoModal";
import { ScreenHeader } from "../components/ScreenHeader";
import { ColorPalette, spacing } from "../theme/colors";
import { createScreenStyles } from "../theme/layout";
import { useColors } from "../theme/ThemeContext";
import { deleteLocalModel, getTotalStorageUsed, importModelFromDevice, listLocalModels, LocalModel } from "../services/modelStorage";
import { formatBytes } from "../utils/format";
import { fuzzyMatch } from "../utils/fuzzy";

export function ModelsScreen({ navigation }: any) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [models, setModels] = useState<LocalModel[]>([]);
  const [totalUsed, setTotalUsed] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [query, setQuery] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [selectedNames, setSelectedNames] = useState<Set<string>>(new Set());
  const [singleDeleteTarget, setSingleDeleteTarget] = useState<string | null>(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [infoModel, setInfoModel] = useState<LocalModel | null>(null);
  const selectionMode = selectedNames.size > 0;

  const filteredModels = useMemo(() => {
    if (!query.trim()) return models;
    return models.filter((m) => fuzzyMatch(m.filename, query));
  }, [models, query]);

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

  const confirmSingleDelete = async () => {
    if (!singleDeleteTarget) return;
    await deleteLocalModel(singleDeleteTarget);
    setSingleDeleteTarget(null);
    await load();
  };

  const toggleSelected = (filename: string) => {
    setSelectedNames((cur) => {
      const next = new Set(cur);
      if (next.has(filename)) next.delete(filename);
      else next.add(filename);
      return next;
    });
  };

  const cancelSelection = () => setSelectedNames(new Set());

  const confirmBulkDelete = async () => {
    for (const filename of selectedNames) {
      await deleteLocalModel(filename);
    }
    setSelectedNames(new Set());
    setBulkDeleteOpen(false);
    await load();
  };

  const importModel = async () => {
    setMenuOpen(false);
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

  const browseHuggingFace = () => {
    setMenuOpen(false);
    navigation.navigate("Browse Hugging Face");
  };

  return (
    <View style={styles.container}>
      <ScreenHeader title="Models" showActions />
      <View style={styles.toolbar}>
        {models.length > 0 ? (
          <View style={styles.searchRow}>
            <Text style={styles.searchIcon}>⌕</Text>
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search downloaded models"
              placeholderTextColor={colors.textSecondary}
              style={styles.search}
              autoCapitalize="none"
            />
            {query.length > 0 ? (
              <Pressable onPress={() => setQuery("")} hitSlop={10} style={styles.clearButton}>
                <Text style={styles.clearButtonLabel}>×</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}
        {importing ? (
          <View style={styles.importBanner}>
            <Text style={styles.importBannerLabel}>Importing model…</Text>
            <IndeterminateProgressBar />
          </View>
        ) : null}
      </View>
      <FlatList
        style={styles.flatList}
        data={filteredModels}
        keyExtractor={(item) => item.filename}
        contentContainerStyle={filteredModels.length === 0 ? styles.emptyListContent : styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.textPrimary} />}
        renderItem={({ item }) => (
          <ModelCard
            model={item}
            onPress={() => setInfoModel(item)}
            selectionMode={selectionMode}
            selected={selectedNames.has(item.filename)}
            onToggleSelect={() => toggleSelected(item.filename)}
            onLongPress={() => toggleSelected(item.filename)}
          />
        )}
        ListEmptyComponent={
          models.length === 0 ? (
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyTitle}>No models yet</Text>
              <Text style={styles.emptySubtitle}>Tap + to browse Hugging Face or import one.</Text>
            </View>
          ) : (
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyTitle}>No matches</Text>
              <Text style={styles.emptySubtitle}>No models match "{query}".</Text>
            </View>
          )
        }
      />

      {!selectionMode ? (
        <View style={styles.statsBar}>
          <Text style={styles.statsBarText}>
            {models.length} downloaded · {formatBytes(totalUsed)} used
          </Text>
        </View>
      ) : null}

      {menuOpen ? (
        <Pressable style={styles.backdrop} onPress={() => setMenuOpen(false)}>
          <View style={styles.menu}>
            <Pressable style={styles.menuItem} onPress={importModel}>
              <Text style={styles.menuItemLabel}>Import from Device</Text>
            </Pressable>
            <View style={styles.menuDivider} />
            <Pressable style={styles.menuItem} onPress={browseHuggingFace}>
              <Text style={styles.menuItemLabel}>Browse Hugging Face</Text>
            </Pressable>
          </View>
        </Pressable>
      ) : null}

      <ModelInfoModal
        visible={infoModel !== null}
        model={infoModel}
        onClose={() => setInfoModel(null)}
        onDelete={() => {
          if (infoModel) setSingleDeleteTarget(infoModel.filename);
          setInfoModel(null);
        }}
      />

      <ConfirmModal
        visible={singleDeleteTarget !== null}
        title="Delete model"
        message={`Delete ${singleDeleteTarget}? This cannot be undone.`}
        confirmLabel="Delete"
        destructive
        onConfirm={confirmSingleDelete}
        onCancel={() => setSingleDeleteTarget(null)}
      />
      <ConfirmModal
        visible={bulkDeleteOpen}
        title={`Delete ${selectedNames.size} model${selectedNames.size === 1 ? "" : "s"}?`}
        message="This cannot be undone and will free up their storage space."
        confirmLabel="Delete"
        destructive
        onConfirm={confirmBulkDelete}
        onCancel={() => setBulkDeleteOpen(false)}
      />

      {selectionMode ? (
        <View style={styles.selectionBar}>
          <Pressable style={styles.cancelChip} onPress={cancelSelection}>
            <Text style={styles.cancelChipLabel}>Cancel</Text>
          </Pressable>
          <Pressable style={styles.deleteChip} onPress={() => setBulkDeleteOpen(true)}>
            <Text style={styles.deleteChipLabel}>Delete ({selectedNames.size})</Text>
          </Pressable>
        </View>
      ) : (
        <Pressable style={styles.fab} onPress={() => setMenuOpen((v) => !v)}>
          <Text style={styles.fabLabel}>{menuOpen ? "×" : "+"}</Text>
        </Pressable>
      )}
    </View>
  );
}

function createStyles(colors: ColorPalette) {
  const screen = createScreenStyles(colors);
  return StyleSheet.create({
    container: screen.container,
    toolbar: { paddingHorizontal: spacing.md, paddingBottom: spacing.sm },
    searchRow: {
      flexDirection: "row",
      alignItems: "center",
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      paddingHorizontal: spacing.sm,
    },
    searchIcon: { color: colors.textSecondary, fontSize: 15, marginRight: spacing.xs },
    search: {
      flex: 1,
      color: colors.textPrimary,
      paddingVertical: spacing.sm,
    },
    clearButton: { paddingHorizontal: spacing.xs, paddingVertical: spacing.xs },
    clearButtonLabel: { color: colors.textSecondary, fontSize: 16, fontWeight: "700" },
    importBanner: { marginTop: spacing.sm, gap: spacing.xs },
    importBannerLabel: { color: colors.textSecondary, fontSize: 12 },
    flatList: { flex: 1 },
    list: { paddingHorizontal: spacing.md, paddingBottom: spacing.xl * 2 },
    emptyListContent: { flexGrow: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: spacing.md },
    emptyWrap: { alignItems: "center", gap: spacing.xs },
    emptyTitle: { color: colors.textPrimary, fontSize: 18, fontWeight: "700", textAlign: "center" },
    emptySubtitle: { color: colors.textSecondary, fontSize: 13, textAlign: "center" },
    statsBar: {
      backgroundColor: colors.surfaceAlt,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      paddingVertical: spacing.xs,
      paddingHorizontal: spacing.md,
    },
    statsBarText: { color: colors.textSecondary, fontSize: 11, textAlign: "center" },
    fab: {
      position: "absolute",
      right: spacing.md,
      bottom: spacing.lg + 40,
      width: 52,
      height: 52,
      borderRadius: 26,
      backgroundColor: colors.accent,
      alignItems: "center",
      justifyContent: "center",
    },
    fabLabel: { color: colors.background, fontSize: 26, fontWeight: "700", lineHeight: 28 },
    backdrop: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
    },
    menu: {
      position: "absolute",
      right: spacing.md,
      bottom: spacing.lg + 40 + 52 + spacing.sm,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      minWidth: 200,
    },
    menuItem: { paddingVertical: spacing.md, paddingHorizontal: spacing.md },
    menuItemLabel: { color: colors.textPrimary, fontSize: 14, fontWeight: "600" },
    menuDivider: { height: 1, backgroundColor: colors.border },
    selectionBar: {
      position: "absolute",
      left: 0,
      right: 0,
      bottom: 0,
      flexDirection: "row",
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    cancelChip: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      borderRightWidth: 1,
      borderRightColor: colors.border,
      backgroundColor: colors.surface,
      paddingVertical: spacing.md,
    },
    cancelChipLabel: { color: colors.textSecondary, fontWeight: "600", fontSize: 14 },
    deleteChip: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.error,
      paddingVertical: spacing.md,
    },
    deleteChipLabel: { color: colors.background, fontWeight: "700", fontSize: 14 },
  });
}
