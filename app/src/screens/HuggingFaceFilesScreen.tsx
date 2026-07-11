import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, FlatList, StyleSheet, Text, View } from "react-native";
import { Button } from "../components/Button";
import { StatusBadge } from "../components/StatusBadge";
import { ColorPalette, spacing } from "../theme/colors";
import { createScreenStyles } from "../theme/layout";
import { useColors } from "../theme/ThemeContext";
import { huggingfaceApi, HfFileSummary } from "../api/huggingface";
import { checkCompatibility, CompatibilityInfo } from "../utils/compatibility";
import { downloadModel, isModelDownloaded, DownloadHandle } from "../services/modelStorage";
import { formatBytes } from "../utils/format";

const CATEGORY_LABEL: Record<string, string> = {
  supported: "SUPPORTED",
  can_bottleneck: "CAN BOTTLENECK",
  not_supported: "NOT SUPPORTED",
  unknown: "UNKNOWN",
};

interface FileRow extends HfFileSummary {
  compatibility: CompatibilityInfo;
  downloaded: boolean;
}

interface ActiveDownload {
  filename: string;
  progress: number;
  handle: DownloadHandle;
}

export function HuggingFaceFilesScreen({ route, navigation }: any) {
  const repoId: string = route.params.repoId;
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [files, setFiles] = useState<FileRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [download, setDownload] = useState<ActiveDownload | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const rawFiles = await huggingfaceApi.listFiles(repoId);
      const rows = await Promise.all(
        rawFiles.map(async (f) => ({
          ...f,
          compatibility: await checkCompatibility(f.size_bytes),
          downloaded: await isModelDownloaded(f.filename),
        }))
      );
      setFiles(rows);
    } catch (err) {
      Alert.alert("Could not load files", String(err));
    } finally {
      setLoading(false);
    }
  }, [repoId]);

  useEffect(() => {
    load();
  }, [load]);

  const startDownload = (file: FileRow) => {
    const handle = downloadModel(huggingfaceApi.downloadUrl(repoId, file.filename), file.filename, (fraction) => {
      setDownload((prev) => (prev ? { ...prev, progress: fraction } : prev));
    });
    setDownload({ filename: file.filename, progress: 0, handle });

    handle.done
      .then(async () => {
        setDownload(null);
        await load();
        Alert.alert("Download complete", `${file.filename} is now available in Models.`, [
          { text: "Go to Models", onPress: () => navigation.navigate("Models List") },
          { text: "Stay here" },
        ]);
      })
      .catch((err) => {
        setDownload(null);
        Alert.alert("Download failed", String(err));
      });
  };

  const confirmDownload = (file: FileRow) => {
    if (download) {
      Alert.alert("Download in progress", "Wait for the current download to finish first.");
      return;
    }
    const category = file.compatibility.category;

    if (category === "not_supported") {
      // Two-step confirmation for the risky tier: an initial warning, then a
      // second, harder confirmation spelling out concrete consequences -
      // proceeding past this point is an explicit, informed choice.
      Alert.alert("This will likely crash from OOM", `${file.filename}\n\n${file.compatibility.message}`, [
        { text: "Cancel", style: "cancel" },
        { text: "Continue Anyway", style: "destructive", onPress: () => confirmRiskyDownloadFinal(file) },
      ]);
      return;
    }

    const title = category === "can_bottleneck" ? "This may bottleneck your device" : "Download this model?";
    Alert.alert(title, `${file.filename}\n\n${file.compatibility.message}`, [
      { text: "Cancel", style: "cancel" },
      { text: "Download", onPress: () => startDownload(file) },
    ]);
  };

  const confirmRiskyDownloadFinal = (file: FileRow) => {
    Alert.alert(
      "Last chance - this is risky",
      "Running this model can cause:\n\n" +
        "- The app crashing or being killed by Android (out-of-memory)\n" +
        "- The whole phone slowing down or freezing temporarily\n" +
        "- Other open apps being force-closed to free memory\n" +
        "- In rare cases, needing to restart the phone\n\n" +
        "Your data won't be damaged, but the experience may be unusable. Proceed entirely at your own risk.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "I Understand, Download", style: "destructive", onPress: () => startDownload(file) },
      ]
    );
  };

  const cancelDownload = async () => {
    if (!download) return;
    await download.handle.cancel();
    setDownload(null);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{repoId}</Text>

      {download ? (
        <View style={styles.progressCard}>
          <Text style={styles.progressLabel}>Downloading {download.filename}</Text>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${Math.min(100, download.progress * 100)}%` }]} />
          </View>
          <View style={styles.progressRow}>
            <Text style={styles.progressText}>{(download.progress * 100).toFixed(0)}%</Text>
            <Button label="Cancel" variant="danger" onPress={cancelDownload} />
          </View>
        </View>
      ) : null}

      <FlatList
        data={files}
        keyExtractor={(item) => item.filename}
        contentContainerStyle={styles.list}
        refreshing={loading}
        onRefresh={load}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.headerRow}>
              <Text style={styles.filename}>{item.filename}</Text>
              {item.downloaded ? (
                <StatusBadge status="pass" label="DOWNLOADED" />
              ) : (
                <StatusBadge status={item.compatibility.category} label={CATEGORY_LABEL[item.compatibility.category]} />
              )}
            </View>
            <Text style={styles.meta}>{[item.quant, formatBytes(item.size_bytes)].filter(Boolean).join(" · ")}</Text>
            {!item.downloaded ? <Text style={styles.compatMessage}>{item.compatibility.message}</Text> : null}
            {!item.downloaded ? <Button label="Download" onPress={() => confirmDownload(item)} variant="secondary" /> : null}
          </View>
        )}
        ListEmptyComponent={!loading ? <Text style={styles.empty}>No single-file GGUF variants found in this repo.</Text> : null}
      />
    </View>
  );
}

function createStyles(colors: ColorPalette) {
  const screen = createScreenStyles(colors);
  return StyleSheet.create({
    container: { ...screen.container, padding: spacing.md },
    title: { color: colors.textPrimary, fontSize: 16, fontWeight: "700", marginBottom: spacing.sm },
    list: { paddingBottom: spacing.lg },
    card: { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, padding: spacing.md, marginBottom: spacing.sm },
    headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.xs },
    filename: { color: colors.textPrimary, fontWeight: "600", fontSize: 13, flexShrink: 1, marginRight: spacing.sm, fontFamily: "monospace" },
    meta: { color: colors.textSecondary, fontSize: 12, fontFamily: "monospace", marginBottom: spacing.xs },
    compatMessage: { color: colors.textSecondary, fontSize: 11, marginBottom: spacing.sm },
    empty: { color: colors.textSecondary, textAlign: "center", marginTop: spacing.lg },
    progressCard: { borderWidth: 1, borderColor: colors.accent, backgroundColor: colors.surface, padding: spacing.md, marginBottom: spacing.md },
    progressLabel: { color: colors.textPrimary, fontSize: 12, fontFamily: "monospace", marginBottom: spacing.xs },
    progressTrack: { height: 6, backgroundColor: colors.surfaceAlt, marginBottom: spacing.xs },
    progressFill: { height: 6, backgroundColor: colors.accent },
    progressRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    progressText: { color: colors.textSecondary, fontSize: 11, fontFamily: "monospace" },
  });
}
