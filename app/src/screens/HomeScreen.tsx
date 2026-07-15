import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BackHandler, Pressable, StyleSheet, ToastAndroid, View } from "react-native";
import { Text } from "../components/Text";
import { useFocusEffect } from "@react-navigation/native";
import DeviceInfo from "react-native-device-info";
import { Card } from "../components/Card";
import { DeviceDetailsModal } from "../components/DeviceDetailsModal";
import { SuggestedModelSizeModal } from "../components/SuggestedModelSizeModal";
import { ScreenHeader } from "../components/ScreenHeader";
import { spacing, ColorPalette } from "../theme/colors";
import { createScreenStyles } from "../theme/layout";
import { useColors } from "../theme/ThemeContext";
import { useProjectStore } from "../state/useProjectStore";
import { useDownloadStore } from "../state/useDownloadStore";
import { getTotalStorageUsed, listLocalModels } from "../services/modelStorage";
import { getSuggestedModelBudget, SuggestedModelBudget } from "../utils/compatibility";
import { getStorageInfo, StorageInfo } from "../utils/deviceInfo";
import { formatBytes } from "../utils/format";

export function HomeScreen({ navigation }: any) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const projects = useProjectStore((s) => s.projects);
  const projectCount = projects.length;
  const history = useProjectStore((s) => s.history);
  const [modelCount, setModelCount] = useState(0);
  const [storageUsed, setStorageUsed] = useState(0);
  const [budget, setBudget] = useState<SuggestedModelBudget | null>(null);
  const [deviceStorage, setDeviceStorage] = useState<StorageInfo | null>(null);
  const [deviceModalVisible, setDeviceModalVisible] = useState(false);
  const [suggestedModalVisible, setSuggestedModalVisible] = useState(false);
  const downloads = useDownloadStore((s) => s.downloads);
  const activeDownloads = Object.values(downloads);

  const load = useCallback(async () => {
    const [models, used, suggested, storage] = await Promise.all([
      listLocalModels(),
      getTotalStorageUsed(),
      getSuggestedModelBudget(),
      getStorageInfo(),
    ]);
    setModelCount(models.length);
    setStorageUsed(used);
    setBudget(suggested);
    setDeviceStorage(storage);
  }, []);

  useEffect(() => {
    load();
    const unsubscribe = navigation.addListener("focus", load);
    return unsubscribe;
  }, [navigation, load]);

  const analytics = useMemo(() => {
    if (history.length === 0) return null;
    const chats = history.filter((h) => !h.viaFlowId);
    const flowRuns = history.filter((h) => h.viaFlowId);
    const totalTokens = history.reduce((sum, h) => sum + h.tokensGenerated, 0);
    // Peak, not average — a flow run's zeroed stats would otherwise drag an
    // average down to something meaningless; peak also doubles as a rough
    // "what this device can actually do" indicator.
    const peakTokPerSec = chats.reduce((max, h) => Math.max(max, h.tokensPerSecond), 0);

    const countByProject = new Map<string, number>();
    for (const h of history) countByProject.set(h.projectId, (countByProject.get(h.projectId) ?? 0) + 1);
    let mostActiveProjectId: string | null = null;
    let mostActiveCount = 0;
    for (const [projectId, count] of countByProject) {
      if (count > mostActiveCount) {
        mostActiveCount = count;
        mostActiveProjectId = projectId;
      }
    }
    const mostActiveProject = mostActiveProjectId ? projects.find((p) => p.id === mostActiveProjectId) : undefined;

    return { chats: chats.length, flowRuns: flowRuns.length, totalTokens, peakTokPerSec, mostActiveProject };
  }, [history, projects]);

  // Home is the app's root screen — back here should ask for a second
  // press within 2s before actually exiting, rather than quitting on the
  // first accidental press. Only active while Home is focused.
  const lastBackPress = useRef(0);
  useFocusEffect(
    useCallback(() => {
      const onBackPress = () => {
        const now = Date.now();
        if (now - lastBackPress.current < 2000) {
          BackHandler.exitApp();
          return true;
        }
        lastBackPress.current = now;
        ToastAndroid.show("Press back again to exit", ToastAndroid.SHORT);
        return true;
      };
      const sub = BackHandler.addEventListener("hardwareBackPress", onBackPress);
      return () => sub.remove();
    }, [])
  );

  return (
    <View style={styles.container}>
      <ScreenHeader title="Home" showActions />
      <View style={styles.content}>
      {activeDownloads.length > 0 ? (
        <Pressable onPress={() => navigation.navigate("Models")}>
          <Card>
            <Text style={styles.cardTitle}>Downloading</Text>
            {activeDownloads.map((d) => (
              <View key={d.filename} style={styles.downloadRow}>
                <Text style={[styles.value, styles.downloadFilename]} numberOfLines={1}>
                  {d.filename}
                </Text>
                {d.status === "failed" ? (
                  <Text style={styles.downloadFailedLabel}>Failed</Text>
                ) : (
                  <Text style={styles.downloadPercentLabel}>{(d.progress * 100).toFixed(0)}%</Text>
                )}
              </View>
            ))}
          </Card>
        </Pressable>
      ) : null}
      <Pressable onPress={() => setDeviceModalVisible(true)}>
        <Card>
          <View style={styles.cardTitleRow}>
            <Text style={styles.cardTitle}>This Device</Text>
            <Text style={styles.detailsHint}>Details ›</Text>
          </View>
          <Text style={styles.value}>{DeviceInfo.getModel()}</Text>
          {budget ? (
            <>
              <Text style={styles.value}>
                {budget.totalMb >= 1024 ? `${(budget.totalMb / 1024).toFixed(1)} GB` : `${budget.totalMb.toFixed(0)} MB`} RAM
              </Text>
              {deviceStorage ? (
                <Text style={styles.value}>
                  {formatBytes(deviceStorage.freeMb * 1024 * 1024)} free of{" "}
                  {formatBytes(deviceStorage.totalMb * 1024 * 1024)} storage
                </Text>
              ) : null}
              <Pressable onPress={() => setSuggestedModalVisible(true)}>
                <View style={styles.suggestionBox}>
                  <Text style={styles.suggestionLabel}>Suggested model size ›</Text>
                  <Text style={styles.suggestionValue}>
                    up to ~{budget.maxParamsBillion.toFixed(1)}B parameters (Q4)
                  </Text>
                  <Text style={styles.suggestionNote}>Tap for a breakdown across quantization levels.</Text>
                </View>
              </Pressable>
            </>
          ) : (
            <Text style={styles.value}>Could not read device memory.</Text>
          )}
        </Card>
      </Pressable>

      <Card>
        <Text style={styles.cardTitle}>Library</Text>
        <Text style={styles.value}>{modelCount} model{modelCount === 1 ? "" : "s"} downloaded — {formatBytes(storageUsed)}</Text>
        <Text style={styles.value}>{projectCount} project{projectCount === 1 ? "" : "s"}</Text>
      </Card>

      <Card>
        <Text style={styles.cardTitle}>Analytics</Text>
        {analytics ? (
          <>
            <Text style={styles.value}>
              {analytics.chats} chat{analytics.chats === 1 ? "" : "s"}
              {analytics.flowRuns > 0 ? ` · ${analytics.flowRuns} flow run${analytics.flowRuns === 1 ? "" : "s"}` : ""}
            </Text>
            <Text style={styles.value}>{analytics.totalTokens.toLocaleString()} tokens generated total</Text>
            {analytics.peakTokPerSec > 0 ? (
              <Text style={styles.value}>{analytics.peakTokPerSec.toFixed(1)} tok/s peak</Text>
            ) : null}
            {analytics.mostActiveProject ? (
              <Text style={styles.value}>
                Most active: {analytics.mostActiveProject.name}
                {analytics.mostActiveProject.modelFilename ? ` (${analytics.mostActiveProject.modelFilename})` : ""}
              </Text>
            ) : null}
          </>
        ) : (
          <Text style={styles.value}>No inference runs yet.</Text>
        )}
      </Card>

      <Card>
        <Text style={styles.cardTitle}>Quick Actions</Text>
        <View style={styles.actionsRow}>
          <QuickAction label="Models" onPress={() => navigation.navigate("Models")} styles={styles} />
          <QuickAction label="Projects" onPress={() => navigation.navigate("Projects")} styles={styles} />
          <QuickAction label="Inference" onPress={() => navigation.navigate("Inference")} styles={styles} />
        </View>
        <View style={[styles.actionsRow, styles.actionsRowGap]}>
          <QuickAction label="Playground" onPress={() => navigation.navigate("Playground")} styles={styles} />
          <QuickAction
            label="Manage Agents"
            onPress={() => navigation.navigate("Playground", { screen: "Agent Library" })}
            styles={styles}
          />
        </View>
      </Card>

      </View>

      <DeviceDetailsModal visible={deviceModalVisible} onClose={() => setDeviceModalVisible(false)} />
      <SuggestedModelSizeModal
        visible={suggestedModalVisible}
        onClose={() => setSuggestedModalVisible(false)}
        budget={budget}
      />
    </View>
  );
}

function QuickAction({
  label,
  onPress,
  styles,
}: {
  label: string;
  onPress: () => void;
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.quickAction, pressed && styles.quickActionPressed]}>
      <Text style={styles.quickActionText}>{label}</Text>
    </Pressable>
  );
}

function createStyles(colors: ColorPalette) {
  const screen = createScreenStyles(colors);
  return StyleSheet.create({
    container: screen.container,
    content: { padding: spacing.md, paddingTop: 0 },
    cardTitleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    cardTitle: { color: colors.textPrimary, fontSize: 16, fontWeight: "600", marginBottom: spacing.sm },
    detailsHint: { color: colors.accentSecondary, fontSize: 12, fontWeight: "600" },
    value: { color: colors.textSecondary, fontSize: 13, marginBottom: 2 },
    downloadRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    downloadFilename: { flex: 1, marginRight: spacing.sm, marginBottom: 0 },
    downloadPercentLabel: { color: colors.accent, fontSize: 13, fontWeight: "700", fontFamily: "monospace" },
    downloadFailedLabel: { color: colors.error, fontSize: 13, fontWeight: "700" },
    suggestionBox: {
      borderWidth: 1,
      borderColor: colors.accent,
      backgroundColor: colors.accent + "22",
      padding: spacing.sm,
      marginTop: spacing.sm,
    },
    suggestionLabel: { color: colors.textSecondary, fontSize: 11, fontFamily: "monospace" },
    suggestionValue: { color: colors.accent, fontSize: 16, fontWeight: "700", marginTop: 2 },
    suggestionNote: { color: colors.textSecondary, fontSize: 11, marginTop: spacing.xs },
    actionsRow: { flexDirection: "row", gap: spacing.sm },
    actionsRowGap: { marginTop: spacing.sm },
    quickAction: {
      flex: 1,
      borderWidth: 1,
      borderColor: colors.border,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      alignItems: "center",
    },
    quickActionPressed: { backgroundColor: colors.surfaceAlt },
    quickActionText: { color: colors.accent, fontWeight: "600", fontSize: 13 },
  });
}
