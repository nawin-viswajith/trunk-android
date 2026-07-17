import React, { useCallback, useEffect, useMemo, useState } from "react";
import { FlatList, StyleSheet, View } from "react-native";
import { Text } from "../components/Text";
import { Button } from "../components/Button";
import { StatusBadge } from "../components/StatusBadge";
import { ColorPalette, spacing } from "../theme/colors";
import { createScreenStyles } from "../theme/layout";
import { useColors } from "../theme/ThemeContext";
import { huggingfaceApi, HfFileSummary } from "../api/huggingface";
import { HfModelSummary } from "../api/types";
import { checkCompatibility, CompatibilityInfo } from "../utils/compatibility";
import { downloadModel, isModelDownloaded, getModelSource, recordModelSource, maybeBackupModel } from "../services/modelStorage";
import { canProceedWithDownload } from "../services/downloadPolicy";
import { formatBytes } from "../utils/format";
import { showAlert } from "../state/useAlertStore";
import { reportDownloadProgress, stopTrackingDownload, useDownloadStore } from "../state/useDownloadStore";
import { useBackendHealth } from "../services/backendHealth";
import { BackendStatusBanner } from "../components/BackendStatusBanner";

const CATEGORY_LABEL: Record<string, string> = {
  supported: "SUPPORTED",
  can_bottleneck: "CAN BOTTLENECK",
  not_supported: "NOT SUPPORTED",
  unknown: "UNKNOWN",
};

interface FileRow extends HfFileSummary {
  compatibility: CompatibilityInfo;
  downloaded: boolean;
  /** A local file with this exact name exists, but was recorded as coming
   * from a different repo — GGUF repos often reuse generic filenames, so
   * "exists locally" alone isn't proof it's actually this repo's file. */
  sourceConflict: boolean;
}

/** Walks up to the root Tab.Navigator to check whether "Models" is the
 * currently active tab - re-checked fresh at completion time (not render
 * time), since the download can easily finish minutes after the user
 * wandered off to another tab. */
function isModelsTabActive(navigation: any): boolean {
  let nav = navigation;
  while (nav) {
    const state = nav.getState?.();
    if (state?.type === "tab") {
      return state.routeNames[state.index] === "Models";
    }
    nav = nav.getParent?.();
  }
  return false;
}

const FULL_PRECISION_QUANTS = new Set(["F16", "F32", "BF16"]);

/** Flags reasons this file might not be what a first-time downloader expects
 * — surfaced as a disclaimer before the existing RAM-compatibility confirm,
 * since "fits in RAM" says nothing about whether the file is quantized or
 * even a text-generation model at all. */
function buildDownloadCaveats(file: FileRow, model: HfModelSummary | undefined): string[] {
  const caveats: string[] = [];
  if (!file.quant) {
    caveats.push("Couldn't determine the quantization level from the filename — verify this is actually a GGUF quant before downloading.");
  } else if (FULL_PRECISION_QUANTS.has(file.quant)) {
    caveats.push(`This is a full-precision (${file.quant}) file, not a quantized one — it will be far larger and slower than a Q4/Q5/Q6 variant.`);
  }
  if (model?.pipeline_tag && model.pipeline_tag !== "text-generation") {
    caveats.push(`This repo is tagged "${model.pipeline_tag}", not text-generation — it may not be a chat/completion model the app can run.`);
  } else if (!model?.pipeline_tag) {
    caveats.push("Couldn't confirm this is a text-generation model — it may be an embedding or other non-chat model.");
  }
  return caveats;
}

export function HuggingFaceFilesScreen({ route, navigation }: any) {
  const repoId: string = route.params.repoId;
  const model: HfModelSummary | undefined = route.params.model;
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [files, setFiles] = useState<FileRow[]>([]);
  const [loading, setLoading] = useState(true);
  const downloads = useDownloadStore((s) => s.downloads);
  const activeDownload = Object.values(downloads).find((d) => d.status === "downloading");
  const failedDownload = Object.values(downloads).find((d) => d.status === "failed");
  const { status: backendStatus, retry: retryBackend } = useBackendHealth();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const rawFiles = await huggingfaceApi.listFiles(repoId);
      const rows = await Promise.all(
        rawFiles.map(async (f) => {
          const downloaded = await isModelDownloaded(f.filename);
          const source = downloaded ? await getModelSource(f.filename) : null;
          return {
            ...f,
            compatibility: await checkCompatibility(f.size_bytes),
            downloaded,
            sourceConflict: downloaded && source !== null && source !== repoId,
          };
        })
      );
      setFiles(rows);
    } catch (err) {
      showAlert("Could not load files", String(err));
    } finally {
      setLoading(false);
    }
  }, [repoId]);

  useEffect(() => {
    load();
  }, [load]);

  const startDownload = async (file: FileRow) => {
    if (!(await canProceedWithDownload(file.filename))) return;

    const url = huggingfaceApi.downloadUrl(repoId, file.filename);
    const handle = downloadModel(url, file.filename, file.size_bytes, (fraction) => {
      reportDownloadProgress(file.filename, fraction);
    });
    useDownloadStore.getState().beginDownload(file.filename, url, file.size_bytes, handle.cancel);

    handle.done
      .then(async () => {
        stopTrackingDownload(file.filename);
        useDownloadStore.getState().clearDownload(file.filename);
        await recordModelSource(file.filename, repoId);
        await maybeBackupModel(file.filename);
        await load();
        showAlert(
          "Download complete",
          `${file.filename} is now available in Models.`,
          isModelsTabActive(navigation)
            ? [{ label: "OK" }]
            : [
                { label: "Go to Models", onPress: () => navigation.navigate("Models List") },
                { label: "Stay here", variant: "neutral" },
              ]
        );
      })
      .catch((err) => {
        stopTrackingDownload(file.filename);
        // The failed entry stays in the store (not cleared) so the banner
        // below survives even if this alert is missed - dismiss/retry both
        // route through it instead of only existing in this one-shot alert.
        useDownloadStore.getState().setFailed(file.filename, String(err));
        showAlert("Download failed", String(err));
      });
  };

  const retryDownload = (filename: string) => {
    useDownloadStore.getState().clearDownload(filename);
    const file = files.find((f) => f.filename === filename);
    if (file) startDownload(file);
  };

  const confirmDownload = (file: FileRow) => {
    if (activeDownload) {
      showAlert("Download in progress", "Wait for the current download to finish first.");
      return;
    }
    if (file.sourceConflict) {
      showAlert(
        "A different file already uses this name",
        `A local model named "${file.filename}" already exists, downloaded from a different repo. Continuing will overwrite it.`,
        [
          { label: "Cancel", variant: "neutral" },
          { label: "Continue Anyway", variant: "danger", onPress: () => confirmDownloadForCompatibility(file) },
        ]
      );
      return;
    }
    const caveats = buildDownloadCaveats(file, model);
    if (caveats.length > 0) {
      showAlert("Before you download", caveats.join("\n\n"), [
        { label: "Cancel", variant: "neutral" },
        { label: "Continue", onPress: () => confirmDownloadForCompatibility(file) },
      ]);
      return;
    }
    confirmDownloadForCompatibility(file);
  };

  const confirmDownloadForCompatibility = (file: FileRow) => {
    const category = file.compatibility.category;

    if (category === "not_supported") {
      // Two-step confirmation for the risky tier: an initial warning, then a
      // second, harder confirmation spelling out concrete consequences -
      // proceeding past this point is an explicit, informed choice.
      showAlert("This will likely crash from OOM", `${file.filename}\n\n${file.compatibility.message}`, [
        { label: "Cancel", variant: "neutral" },
        { label: "Continue Anyway", variant: "danger", onPress: () => confirmRiskyDownloadFinal(file) },
      ]);
      return;
    }

    const title = category === "can_bottleneck" ? "This may bottleneck your device" : "Download this model?";
    showAlert(title, `${file.filename}\n\n${file.compatibility.message}`, [
      { label: "Cancel", variant: "neutral" },
      { label: "Download", onPress: () => startDownload(file) },
    ]);
  };

  const confirmRiskyDownloadFinal = (file: FileRow) => {
    showAlert(
      "Last chance — this is risky",
      "Running this model can cause:\n\n" +
        "- The app crashing or being killed by Android (out-of-memory)\n" +
        "- The whole phone slowing down or freezing temporarily\n" +
        "- Other open apps being force-closed to free memory\n" +
        "- In rare cases, needing to restart the phone\n\n" +
        "Your data won't be damaged, but the experience may be unusable. Proceed entirely at your own risk.",
      [
        { label: "Cancel", variant: "neutral" },
        { label: "I Understand, Download", variant: "danger", onPress: () => startDownload(file) },
      ]
    );
  };

  const cancelDownload = async () => {
    if (!activeDownload) return;
    stopTrackingDownload(activeDownload.filename);
    await activeDownload.cancel();
    useDownloadStore.getState().clearDownload(activeDownload.filename);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{repoId}</Text>
      <BackendStatusBanner status={backendStatus} onRetry={retryBackend} />

      {activeDownload ? (
        <View style={styles.progressCard}>
          <Text style={styles.progressLabel}>Downloading {activeDownload.filename}</Text>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${Math.min(100, activeDownload.progress * 100)}%` }]} />
          </View>
          <View style={styles.progressRow}>
            <Text style={styles.progressText}>{(activeDownload.progress * 100).toFixed(0)}%</Text>
            <Button label="Cancel" variant="danger" onPress={cancelDownload} />
          </View>
        </View>
      ) : null}

      {failedDownload ? (
        <View style={styles.failedCard}>
          <Text style={styles.failedLabel} numberOfLines={1}>
            {failedDownload.filename} — download failed
          </Text>
          <Text style={styles.failedMessage} numberOfLines={2}>
            {failedDownload.error}
          </Text>
          <View style={styles.progressRow}>
            <Button
              label="Dismiss"
              variant="neutral"
              onPress={() => useDownloadStore.getState().clearDownload(failedDownload.filename)}
            />
            <Button label="Retry" variant="secondary" onPress={() => retryDownload(failedDownload.filename)} />
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
              {item.downloaded && !item.sourceConflict ? (
                <StatusBadge status="pass" label="DOWNLOADED" />
              ) : item.sourceConflict ? (
                <StatusBadge status="warning" label="NAME CONFLICT" />
              ) : (
                <StatusBadge status={item.compatibility.category} label={CATEGORY_LABEL[item.compatibility.category]} />
              )}
            </View>
            <Text style={styles.meta}>{[item.quant, formatBytes(item.size_bytes)].filter(Boolean).join(" · ")}</Text>
            {item.sourceConflict ? (
              <Text style={styles.compatMessage}>
                A different local model already uses this filename - downloading will overwrite it.
              </Text>
            ) : !item.downloaded ? (
              <Text style={styles.compatMessage}>{item.compatibility.message}</Text>
            ) : null}
            {!item.downloaded || item.sourceConflict ? (
              <Button label="Download" onPress={() => confirmDownload(item)} variant="secondary" />
            ) : null}
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
    failedCard: { borderWidth: 1, borderColor: colors.error, backgroundColor: colors.surface, padding: spacing.md, marginBottom: spacing.md },
    failedLabel: { color: colors.error, fontSize: 12, fontFamily: "monospace", fontWeight: "700", marginBottom: 2 },
    failedMessage: { color: colors.textSecondary, fontSize: 11, marginBottom: spacing.sm },
  });
}
