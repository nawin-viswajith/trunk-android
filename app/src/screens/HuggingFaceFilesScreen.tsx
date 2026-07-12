import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, FlatList, StyleSheet, Text, View } from "react-native";
import { Button } from "../components/Button";
import { StatusBadge } from "../components/StatusBadge";
import { spacing, ColorPalette } from "../theme/colors";
import { useColors } from "../theme/ThemeContext";
import { huggingfaceApi } from "../api/huggingface";
import { connectJsonWs } from "../api/ws";
import { useSettingsStore } from "../state/useSettingsStore";
import { HfDownloadFrame, HfGgufFile } from "../api/types";
import { formatBytes } from "../utils/format";

const CATEGORY_LABEL: Record<string, string> = {
  supported: "SUPPORTED",
  can_bottleneck: "CAN BOTTLENECK",
  not_supported: "NOT SUPPORTED",
  unknown: "UNKNOWN",
};

interface ActiveDownload {
  filename: string;
  jobId: string;
  downloadedBytes: number;
  totalBytes: number;
}

export function HuggingFaceFilesScreen({ route, navigation }: any) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const repoId: string = route.params.repoId;
  const serial = useSettingsStore((s) => s.activeDeviceSerial);
  const [files, setFiles] = useState<HfGgufFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [download, setDownload] = useState<ActiveDownload | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setFiles(await huggingfaceApi.listFiles(repoId, serial));
    } catch (err) {
      Alert.alert("Could not load files", String(err));
    } finally {
      setLoading(false);
    }
  }, [repoId, serial]);

  useEffect(() => {
    load();
  }, [load]);

  const startDownload = async (file: HfGgufFile) => {
    try {
      const { job_id } = await huggingfaceApi.download(repoId, file.filename, serial);
      setDownload({ filename: file.filename, jobId: job_id, downloadedBytes: 0, totalBytes: file.size_bytes });

      const disconnect = connectJsonWs<HfDownloadFrame>(`/ws/huggingface/${job_id}`, (frame) => {
        if (frame.type === "progress") {
          setDownload((prev) => (prev ? { ...prev, downloadedBytes: frame.downloaded_bytes, totalBytes: frame.total_bytes } : prev));
        } else if (frame.type === "done") {
          setDownload(null);
          disconnect();
          Alert.alert("Download complete", `${file.filename} is now available in Models.`, [
            { text: "Go to Models", onPress: () => navigation.navigate("Models List") },
            { text: "Stay here" },
          ]);
        } else if (frame.type === "cancelled") {
          setDownload(null);
          disconnect();
        } else if (frame.type === "error") {
          setDownload(null);
          disconnect();
          Alert.alert("Download failed", frame.message);
        }
      });
    } catch (err) {
      Alert.alert("Could not start download", String(err));
    }
  };

  const confirmDownload = (file: HfGgufFile) => {
    if (download) {
      Alert.alert("Download in progress", "Wait for the current download to finish first.");
      return;
    }
    const category = file.compatibility.category;
    const title = category === "not_supported" ? "This will likely crash from OOM" : "Download this model?";
    const buttonLabel = category === "not_supported" ? "Download Anyway" : "Download";
    Alert.alert(title, `${file.filename}\n\n${file.compatibility.message}`, [
      { text: "Cancel", style: "cancel" },
      { text: buttonLabel, style: category === "not_supported" ? "destructive" : "default", onPress: () => startDownload(file) },
    ]);
  };

  const cancelDownload = async () => {
    if (!download) return;
    await huggingfaceApi.cancel(download.jobId);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{repoId}</Text>
      {!serial ? <Text style={styles.warning}>No device connected -- compatibility can't be checked yet.</Text> : null}

      {download ? (
        <View style={styles.progressCard}>
          <Text style={styles.progressLabel}>Downloading {download.filename}</Text>
          <View style={styles.progressTrack}>
            <View
              style={[
                styles.progressFill,
                { width: `${download.totalBytes ? Math.min(100, (download.downloadedBytes / download.totalBytes) * 100) : 0}%` },
              ]}
            />
          </View>
          <View style={styles.progressRow}>
            <Text style={styles.progressText}>
              {formatBytes(download.downloadedBytes)} / {formatBytes(download.totalBytes)}
            </Text>
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
              <StatusBadge status={item.compatibility.category} label={CATEGORY_LABEL[item.compatibility.category]} />
            </View>
            <Text style={styles.meta}>{[item.quant, formatBytes(item.size_bytes)].filter(Boolean).join(" · ")}</Text>
            <Text style={styles.compatMessage}>{item.compatibility.message}</Text>
            <Button label="Download" onPress={() => confirmDownload(item)} variant="secondary" />
          </View>
        )}
        ListEmptyComponent={!loading ? <Text style={styles.empty}>No single-file GGUF variants found in this repo.</Text> : null}
      />
    </View>
  );
}

function createStyles(colors: ColorPalette) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background, padding: spacing.md },
    title: { color: colors.textPrimary, fontSize: 16, fontWeight: "700", marginBottom: spacing.sm },
    warning: { color: colors.warning, fontSize: 12, marginBottom: spacing.sm },
    list: { paddingBottom: spacing.lg },
    card: { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, padding: spacing.md, marginBottom: spacing.sm },
    headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.xs },
    filename: { color: colors.textPrimary, fontWeight: "600", fontSize: 13, flexShrink: 1, marginRight: spacing.sm, fontFamily: "monospace" },
    meta: { color: colors.textSecondary, fontSize: 12, fontFamily: "monospace", marginBottom: spacing.xs },
    compatMessage: { color: colors.textSecondary, fontSize: 11, marginBottom: spacing.sm },
    empty: { color: colors.textSecondary, textAlign: "center", marginTop: spacing.lg },
    progressCard: { borderWidth: 1, borderColor: colors.cpu, backgroundColor: colors.surface, padding: spacing.md, marginBottom: spacing.md },
    progressLabel: { color: colors.textPrimary, fontSize: 12, fontFamily: "monospace", marginBottom: spacing.xs },
    progressTrack: { height: 6, backgroundColor: colors.surfaceAlt, marginBottom: spacing.xs },
    progressFill: { height: 6, backgroundColor: colors.cpu },
    progressRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    progressText: { color: colors.textSecondary, fontSize: 11, fontFamily: "monospace" },
  });
}
