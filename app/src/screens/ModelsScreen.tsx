import React, { useCallback, useEffect, useMemo, useState } from "react";
import { FlatList, Pressable, RefreshControl, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Text } from "../components/Text";
import { TextInput } from "../components/TextInput";
import { ConfirmModal } from "../components/ConfirmModal";
import { IndeterminateProgressBar } from "../components/IndeterminateProgressBar";
import { ModelCard } from "../components/ModelCard";
import { ModelInfoModal } from "../components/ModelInfoModal";
import { GuideStep } from "../components/PageGuideModal";
import { ScreenHeader } from "../components/ScreenHeader";
import { AddTile } from "../components/AddTile";
import { StatsBar } from "../components/StatsBar";
import { ColorPalette, spacing } from "../theme/colors";
import { createScreenStyles } from "../theme/layout";
import { useColors } from "../theme/ThemeContext";
import {
  deleteLocalModel,
  exportModelToDevice,
  getTotalStorageUsed,
  importModelFromDevice,
  listLocalModels,
  LocalModel,
} from "../services/modelStorage";
import { formatBytes } from "../utils/format";
import { fuzzyMatch } from "../utils/fuzzy";
import { showAlert } from "../state/useAlertStore";
import { flushDownloadProgress, retryFailedDownload, useDownloadStore } from "../state/useDownloadStore";

const GUIDE_STEPS: GuideStep[] = [
  {
    title: "Browse & download",
    description: "Tap \"Add a model\" then \"Browse Hugging Face\" to search GGUF models and download one straight to your device.",
  },
  {
    title: "Import your own",
    description: "Already have a GGUF file? Tap \"Add a model\" then \"Import from Device\" instead of downloading.",
  },
  {
    title: "Check the details",
    description: "Tap a model to see its quantization and size, and whether it comfortably fits your device's RAM.",
  },
  {
    title: "Free up space",
    description: "Hold a model to select it (and others) for bulk delete, freeing up storage.",
  },
];

export function ModelsScreen({ navigation }: any) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
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
  const [exporting, setExporting] = useState(false);
  const selectionMode = selectedNames.size > 0;
  const downloads = useDownloadStore((s) => s.downloads);
  const activeDownloads = Object.values(downloads);

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
    activeDownloads.forEach((d) => flushDownloadProgress(d.filename));
    await load();
    setRefreshing(false);
  };

  const confirmSingleDelete = async () => {
    if (!singleDeleteTarget) return;
    await deleteLocalModel(singleDeleteTarget);
    setSingleDeleteTarget(null);
    await load();
  };

  const exportModel = async () => {
    if (!infoModel) return;
    setExporting(true);
    try {
      const exported = await exportModelToDevice(infoModel.filename);
      if (exported) showAlert("Model exported", `${infoModel.filename} was copied to the folder you chose.`);
    } catch (err) {
      showAlert("Export failed", String(err instanceof Error ? err.message : err));
    } finally {
      setExporting(false);
    }
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
      showAlert("Import failed", String(err));
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
      <ScreenHeader title="Models" showActions guideSteps={GUIDE_STEPS} />
      <AddTile label="Add a model" onPress={() => setMenuOpen((v) => !v)} />
      {models.length > 0 || importing || activeDownloads.length > 0 ? (
      <View style={styles.toolbar}>
        {models.length > 0 ? (
          <View style={styles.searchRow}>
            <Text style={styles.searchIcon}>{`\u2315`}</Text>
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
                <Text style={styles.clearButtonLabel}>{`\u00D7`}</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}
        {importing ? (
          <View style={styles.importBanner}>
            <Text style={styles.importBannerLabel}>{`Importing model\u2026`}</Text>
            <IndeterminateProgressBar />
          </View>
        ) : null}
        {activeDownloads.map((d) =>
          d.status === "failed" ? (
            <View key={d.filename} style={styles.downloadBannerFailed}>
              <View style={styles.downloadBannerTextWrap}>
                <Text style={styles.downloadBannerFailedLabel} numberOfLines={1}>
                  {d.filename} {"-"} download failed
                </Text>
              </View>
              <Pressable onPress={() => retryFailedDownload(d.filename)} hitSlop={10} style={styles.downloadBannerRetry}>
                <Text style={styles.downloadBannerRetryLabel}>Retry</Text>
              </Pressable>
              <Pressable onPress={() => useDownloadStore.getState().clearDownload(d.filename)} hitSlop={10}>
                <Text style={styles.downloadBannerDismiss}>{`\u00D7`}</Text>
              </Pressable>
            </View>
          ) : (
            <View key={d.filename} style={styles.downloadBanner}>
              <Text style={styles.downloadBannerLabel} numberOfLines={1}>
                Downloading {d.filename} {"-"} {(d.progress * 100).toFixed(0)}%
              </Text>
              <View style={styles.downloadBannerTrack}>
                <View style={[styles.downloadBannerFill, { width: `${Math.min(100, d.progress * 100)}%` }]} />
              </View>
            </View>
          )
        )}
      </View>
      ) : null}
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
            downloadProgress={downloads[item.filename]?.status === "downloading" ? downloads[item.filename].progress : undefined}
          />
        )}
        ListEmptyComponent={
          models.length === 0 ? (
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyTitle}>No models yet</Text>
              <Text style={styles.emptySubtitle}>Tap "Add a model" to browse Hugging Face or import one.</Text>
            </View>
          ) : (
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyTitle}>No matches</Text>
              <Text style={styles.emptySubtitle}>No models match "{query}".</Text>
            </View>
          )
        }
      />

      {!selectionMode ? <StatsBar left={`${models.length} downloaded`} right={`${formatBytes(totalUsed)} used`} /> : null}

      {menuOpen ? (
        <Pressable style={styles.backdrop} onPress={() => setMenuOpen(false)}>
          <View style={[styles.menu, { top: insets.top + 130 }]}>
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
        onExport={exportModel}
        exporting={exporting}
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
      ) : null}
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
    downloadBanner: {
      borderWidth: 1,
      borderColor: colors.accent,
      backgroundColor: colors.surface,
      padding: spacing.sm,
      marginTop: spacing.sm,
    },
    downloadBannerLabel: { color: colors.textPrimary, fontSize: 12, fontFamily: "monospace", marginBottom: spacing.xs },
    downloadBannerTrack: { height: 4, backgroundColor: colors.surfaceAlt },
    downloadBannerFill: { height: 4, backgroundColor: colors.accent },
    downloadBannerFailed: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      borderWidth: 1,
      borderColor: colors.error,
      backgroundColor: colors.surface,
      padding: spacing.sm,
      marginTop: spacing.sm,
    },
    downloadBannerTextWrap: { flex: 1, marginRight: spacing.sm },
    downloadBannerFailedLabel: { color: colors.error, fontSize: 12, fontFamily: "monospace" },
    downloadBannerRetry: { marginRight: spacing.md },
    downloadBannerRetryLabel: { color: colors.accent, fontSize: 12, fontWeight: "700" },
    downloadBannerDismiss: { color: colors.error, fontSize: 16, fontWeight: "700" },
    flatList: { flex: 1 },
    list: { paddingHorizontal: spacing.md, paddingBottom: spacing.xl * 2 },
    emptyListContent: { flexGrow: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: spacing.md },
    emptyWrap: { alignItems: "center", gap: spacing.xs },
    emptyTitle: { color: colors.textPrimary, fontSize: 18, fontWeight: "700", textAlign: "center" },
    emptySubtitle: { color: colors.textSecondary, fontSize: 13, textAlign: "center" },
    backdrop: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
    },
    menu: {
      position: "absolute",
      left: spacing.md,
      right: spacing.md,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
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
