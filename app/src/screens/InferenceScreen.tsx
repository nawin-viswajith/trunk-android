import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, StyleSheet, Text, TextInput, View } from "react-native";
import { Button } from "../components/Button";
import { TokenStreamView } from "../components/TokenStreamView";
import { ColorPalette, spacing } from "../theme/colors";
import { useColors } from "../theme/ThemeContext";
import { useProjectStore, selectProject } from "../state/useProjectStore";
import { modelPath, isModelDownloaded } from "../services/modelStorage";
import { ensureLoaded, complete } from "../services/llamaEngine";

export function InferenceScreen({ route }: any) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const projectIdParam: string | undefined = route?.params?.projectId;

  const projects = useProjectStore((s) => s.projects);
  const addHistoryEntry = useProjectStore((s) => s.addHistoryEntry);
  const [activeProjectId, setActiveProjectId] = useState<string | undefined>(projectIdParam);
  const [prompt, setPrompt] = useState("");
  const [output, setOutput] = useState("");
  const [running, setRunning] = useState(false);
  const [stats, setStats] = useState<{ tokens: number; tokPerSec: number } | null>(null);

  useEffect(() => {
    if (!activeProjectId && projects.length > 0) setActiveProjectId(projects[0].id);
  }, [activeProjectId, projects]);

  const activeProject = useProjectStore((s) => (activeProjectId ? selectProject(s.projects, activeProjectId) : undefined));

  const send = useCallback(async () => {
    if (!activeProject?.modelFilename || !prompt.trim()) return;
    const trimmedPrompt = prompt.trim();
    setOutput("");
    setStats(null);
    setRunning(true);
    try {
      if (!(await isModelDownloaded(activeProject.modelFilename))) {
        Alert.alert("Model not found", "This project's model is no longer downloaded. Assign a different one.");
        return;
      }

      await ensureLoaded(modelPath(activeProject.modelFilename), { contextLength: activeProject.contextLength });

      let fullText = "";
      const result = await complete(
        {
          messages: [{ role: "user", content: trimmedPrompt }],
          temperature: activeProject.temperature,
          topP: activeProject.topP,
          topK: activeProject.topK,
          maxTokens: activeProject.maxTokens,
        },
        (token) => {
          fullText += token;
          setOutput(fullText);
        }
      );

      setStats({ tokens: result.tokens, tokPerSec: result.tokensPerSecond });
      addHistoryEntry(activeProject.id, trimmedPrompt, result.text, result.tokens, result.tokensPerSecond);
    } catch (err) {
      Alert.alert("Inference error", String(err));
    } finally {
      setRunning(false);
    }
  }, [activeProject, prompt, addHistoryEntry]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Inference</Text>
        <Text style={styles.projectName}>{activeProject?.name ?? "No project selected"}</Text>
      </View>

      <TokenStreamView text={output} />

      {stats ? (
        <Text style={styles.stats}>
          {stats.tokens} tokens · {stats.tokPerSec.toFixed(1)} tok/s
        </Text>
      ) : null}

      <View style={styles.promptRow}>
        <TextInput
          value={prompt}
          onChangeText={setPrompt}
          placeholder="Write a sorting algorithm"
          placeholderTextColor={colors.textSecondary}
          style={styles.input}
          multiline
        />
        <Button label="Send" onPress={send} loading={running} disabled={!activeProject?.modelFilename} />
      </View>
      {!activeProject?.modelFilename ? (
        <Text style={styles.warning}>Assign a model to this project first (Projects tab).</Text>
      ) : null}
    </View>
  );
}

function createStyles(colors: ColorPalette) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background, padding: spacing.md },
    header: { marginBottom: spacing.sm },
    title: { color: colors.textPrimary, fontSize: 20, fontWeight: "700" },
    projectName: { color: colors.textSecondary, fontSize: 12 },
    stats: { color: colors.running, fontSize: 12, fontFamily: "monospace", marginTop: spacing.xs },
    promptRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.md, alignItems: "flex-end" },
    input: {
      flex: 1,
      borderWidth: 1,
      borderColor: colors.border,
      color: colors.textPrimary,
      backgroundColor: colors.surface,
      padding: spacing.sm,
      minHeight: 44,
      maxHeight: 120,
    },
    warning: { color: colors.warning, fontSize: 12, marginTop: spacing.sm },
  });
}
