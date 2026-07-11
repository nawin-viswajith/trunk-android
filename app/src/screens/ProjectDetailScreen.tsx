import React, { useCallback, useEffect, useLayoutEffect, useMemo, useState } from "react";
import { Alert, BackHandler, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { CheckIndicator } from "../components/CheckIndicator";
import { ConfirmModal } from "../components/ConfirmModal";
import { ColorPalette, spacing } from "../theme/colors";
import { createScreenStyles } from "../theme/layout";
import { useColors } from "../theme/ThemeContext";
import { useProjectStore, selectProject, selectHistoryForProject, selectSessionsForProject } from "../state/useProjectStore";
import { listLocalModels, LocalModel, modelPath, isModelDownloaded } from "../services/modelStorage";
import { benchmarkModel } from "../services/llamaEngine";

export function ProjectDetailScreen({ route, navigation }: any) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { projectId } = route.params;
  const returnTo: string | undefined = route.params?.returnTo;

  const project = useProjectStore((s) => selectProject(s.projects, projectId));
  const allHistory = useProjectStore((s) => s.history);
  const allSessions = useProjectStore((s) => s.sessions);
  const history = useMemo(() => selectHistoryForProject(allHistory, projectId), [allHistory, projectId]);
  const sessionSummaries = useMemo(() => {
    return selectSessionsForProject(allSessions, projectId)
      .map((session) => {
        const entries = history.filter((h) => h.sessionId === session.id);
        const promptTokens = entries.reduce((sum, h) => sum + (h.promptTokens ?? 0), 0);
        const completionTokens = entries.reduce((sum, h) => sum + (h.tokensGenerated ?? 0), 0);
        const avgTokPerSec = entries.length
          ? entries.reduce((sum, h) => sum + (h.tokensPerSecond ?? 0), 0) / entries.length
          : 0;
        return { id: session.id, name: session.name, runs: entries.length, promptTokens, completionTokens, avgTokPerSec };
      })
      .filter((s) => s.runs > 0);
  }, [allSessions, projectId, history]);
  const updateProject = useProjectStore((s) => s.updateProject);
  const deleteProject = useProjectStore((s) => s.deleteProject);
  const [models, setModels] = useState<LocalModel[]>([]);
  const [benchmarking, setBenchmarking] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  const [temperature, setTemperature] = useState(String(project?.temperature ?? 0.7));
  const [topP, setTopP] = useState(String(project?.topP ?? 0.9));
  const [topK, setTopK] = useState(String(project?.topK ?? 40));
  const [contextLength, setContextLength] = useState(String(project?.contextLength ?? 2048));
  const [maxTokens, setMaxTokens] = useState(String(project?.maxTokens ?? 512));

  useEffect(() => {
    if (!project) return;
    setTemperature(String(project.temperature));
    setTopP(String(project.topP));
    setTopK(String(project.topK));
    setContextLength(String(project.contextLength));
    setMaxTokens(String(project.maxTokens));
  }, [project?.id]);

  // Arrived here from Inference's model chip (a cross-tab jump): make both
  // the header arrow and the hardware back button return to Inference
  // instead of the default "back to Projects List" the nested stack would
  // otherwise do.
  useLayoutEffect(() => {
    if (!returnTo) return;
    navigation.setOptions({
      headerLeft: () => (
        <Pressable onPress={() => navigation.navigate(returnTo)} hitSlop={12} style={styles.backButton}>
          <Text style={styles.backButtonLabel}>‹</Text>
        </Pressable>
      ),
    });
  }, [returnTo, navigation, styles]);

  useFocusEffect(
    useCallback(() => {
      if (!returnTo) return;
      const onHardwareBack = () => {
        navigation.navigate(returnTo);
        return true;
      };
      const sub = BackHandler.addEventListener("hardwareBackPress", onHardwareBack);
      return () => sub.remove();
    }, [returnTo, navigation])
  );

  const load = useCallback(async () => {
    setModels(await listLocalModels());
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const assignModel = (filename: string) => {
    updateProject(projectId, { modelFilename: filename });
  };

  const applyParams = () => {
    const t = parseFloat(temperature);
    const tp = parseFloat(topP);
    const tk = parseInt(topK, 10);
    const cl = parseInt(contextLength, 10);
    const mt = parseInt(maxTokens, 10);
    if ([t, tp, tk, cl, mt].some((v) => Number.isNaN(v))) {
      Alert.alert("Invalid values", "Enter valid numbers for all parameters.");
      return;
    }
    updateProject(projectId, { temperature: t, topP: tp, topK: tk, contextLength: cl, maxTokens: mt });
  };

  const confirmDelete = () => {
    deleteProject(projectId);
    navigation.goBack();
  };

  const runBenchmark = async () => {
    if (!project?.modelFilename) return;
    if (!(await isModelDownloaded(project.modelFilename))) {
      Alert.alert("Model not found", "This project's model is no longer downloaded.");
      return;
    }
    setBenchmarking(true);
    try {
      const result = await benchmarkModel(modelPath(project.modelFilename), project.contextLength);
      Alert.alert(
        "Benchmark passed",
        `Model loaded and generated text successfully.\n\nLoad time: ${(result.loadTimeMs / 1000).toFixed(1)}s\n` +
          `${result.tokens} tokens @ ${result.tokensPerSecond.toFixed(1)} tok/s`
      );
    } catch (err) {
      Alert.alert("Benchmark failed", `The model failed to load or generate:\n\n${String(err)}`);
    } finally {
      setBenchmarking(false);
    }
  };

  if (!project) return null;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>{project.name}</Text>

      <Card>
        <View style={styles.modelHeaderRow}>
          <Text style={styles.sectionTitle}>Model</Text>
          {project.modelFilename ? (
            <Pressable
              onPress={() => navigation.navigate("Inference", { projectId })}
              style={({ pressed }) => [styles.playButton, pressed && styles.playButtonPressed]}
            >
              <Text style={styles.playButtonLabel}>▶ Run</Text>
            </Pressable>
          ) : null}
        </View>
        <Text style={styles.value}>
          {project.modelFilename ? `Model selected: ${project.modelFilename}` : "No model selected yet"}
        </Text>
        {project.modelFilename ? (
          <Button label="Benchmark model" onPress={runBenchmark} loading={benchmarking} variant="secondary" />
        ) : null}
        <View style={styles.modelList}>
          {models.map((m) => {
            const active = m.filename === project.modelFilename;
            return (
              <Pressable
                key={m.filename}
                onPress={() => assignModel(m.filename)}
                style={[styles.modelOption, active && styles.modelOptionActive]}
              >
                <Text style={[styles.modelOptionLabel, active && styles.modelOptionLabelActive]} numberOfLines={1}>
                  {m.filename}
                </Text>
                <CheckIndicator checked={active} />
              </Pressable>
            );
          })}
          {models.length === 0 ? (
            <Text style={styles.value}>No models downloaded yet - assign one later from the Models tab.</Text>
          ) : null}
        </View>
      </Card>

      <Card>
        <Text style={styles.sectionTitle}>Inference Parameters</Text>
        <View style={styles.paramRow}>
          <Text style={styles.paramLabel}>Temperature</Text>
          <TextInput value={temperature} onChangeText={setTemperature} keyboardType="decimal-pad" style={styles.paramInput} />
        </View>
        <View style={styles.paramRow}>
          <Text style={styles.paramLabel}>Top P</Text>
          <TextInput value={topP} onChangeText={setTopP} keyboardType="decimal-pad" style={styles.paramInput} />
        </View>
        <View style={styles.paramRow}>
          <Text style={styles.paramLabel}>Top K</Text>
          <TextInput value={topK} onChangeText={setTopK} keyboardType="number-pad" style={styles.paramInput} />
        </View>
        <View style={styles.paramRow}>
          <Text style={styles.paramLabel}>Context length</Text>
          <TextInput value={contextLength} onChangeText={setContextLength} keyboardType="number-pad" style={styles.paramInput} />
        </View>
        <View style={styles.paramRow}>
          <Text style={styles.paramLabel}>Max tokens</Text>
          <TextInput value={maxTokens} onChangeText={setMaxTokens} keyboardType="number-pad" style={styles.paramInput} />
        </View>
        <Button label="Apply Parameters" onPress={applyParams} variant="secondary" />
      </Card>

      <Card>
        <Text style={styles.sectionTitle}>History ({history.length})</Text>
        {sessionSummaries.map((s) => (
          <View key={s.id} style={styles.historyEntry}>
            <Text style={styles.historyLine}>
              {s.name} ({s.runs} run{s.runs === 1 ? "" : "s"})
            </Text>
            <Text style={styles.historyMeta}>
              {s.promptTokens} tok in · {s.completionTokens} tok out · {s.avgTokPerSec.toFixed(1)} tok/s
            </Text>
          </View>
        ))}
        {history.length === 0 ? <Text style={styles.value}>No inference runs yet.</Text> : null}
      </Card>

      <Button label="Delete Project" onPress={() => setDeleteConfirmOpen(true)} variant="danger" />

      <ConfirmModal
        visible={deleteConfirmOpen}
        title="Delete project"
        message="This cannot be undone. Its chat history will be deleted too."
        confirmLabel="Delete"
        destructive
        onConfirm={confirmDelete}
        onCancel={() => setDeleteConfirmOpen(false)}
      />
    </ScrollView>
  );
}

function createStyles(colors: ColorPalette) {
  const screen = createScreenStyles(colors);
  return StyleSheet.create({
    container: screen.container,
    content: { padding: spacing.md, gap: spacing.sm },
    title: { color: colors.textPrimary, fontSize: 20, fontWeight: "700", marginBottom: spacing.md },
    sectionTitle: { color: colors.textPrimary, fontSize: 14, fontWeight: "600" },
    backButton: { paddingHorizontal: spacing.sm },
    backButtonLabel: { color: colors.accent, fontSize: 28, fontWeight: "700" },
    modelHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.sm },
    playButton: { borderWidth: 1, borderColor: colors.accent, paddingVertical: 4, paddingHorizontal: spacing.sm },
    playButtonPressed: { backgroundColor: colors.accent + "22" },
    playButtonLabel: { color: colors.accent, fontSize: 12, fontWeight: "700" },
    value: { color: colors.textSecondary, fontSize: 13, marginBottom: spacing.sm },
    modelList: { marginTop: spacing.sm, gap: spacing.xs },
    modelOption: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      borderWidth: 1,
      borderColor: colors.border,
      borderLeftWidth: 3,
      borderLeftColor: "transparent",
      padding: spacing.sm,
    },
    modelOptionActive: { borderColor: colors.accent, borderLeftColor: colors.accentTertiary, backgroundColor: colors.accent + "22" },
    modelOptionLabel: { color: colors.textSecondary, fontSize: 13, fontFamily: "monospace", flexShrink: 1, marginRight: spacing.sm },
    modelOptionLabelActive: { color: colors.accent, fontWeight: "600" },
    paramRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.sm },
    paramLabel: { color: colors.textSecondary, fontSize: 13, width: 110 },
    paramInput: {
      flex: 1,
      borderWidth: 1,
      borderColor: colors.border,
      color: colors.textPrimary,
      backgroundColor: colors.surfaceAlt,
      paddingVertical: spacing.xs,
      paddingHorizontal: spacing.sm,
      fontFamily: "monospace",
    },
    historyEntry: { marginBottom: spacing.sm },
    historyLine: { color: colors.textPrimary, fontSize: 13, fontWeight: "600" },
    historyMeta: { color: colors.running, fontSize: 11, fontFamily: "monospace", marginTop: 2 },
  });
}
