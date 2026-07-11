import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, StyleSheet, Text, TextInput, View } from "react-native";
import { Button } from "../components/Button";
import { TokenStreamView } from "../components/TokenStreamView";
import { ColorPalette, spacing } from "../theme/colors";
import { useColors } from "../theme/ThemeContext";
import { inferenceApi } from "../api/inference";
import { projectsApi } from "../api/projects";
import { connectJsonWs } from "../api/ws";
import { InferenceFrame, Project } from "../api/types";

export function InferenceScreen({ route }: any) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const projectId: string | undefined = route?.params?.projectId;
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string | undefined>(projectId);
  const [prompt, setPrompt] = useState("");
  const [output, setOutput] = useState("");
  const [running, setRunning] = useState(false);
  const [stats, setStats] = useState<{ tokens: number; tok_per_sec: number } | null>(null);

  const load = useCallback(async () => {
    const list = await projectsApi.list();
    setProjects(list);
    if (!activeProjectId && list.length > 0) setActiveProjectId(list[0].id);
  }, [activeProjectId]);

  useEffect(() => {
    load();
  }, [load]);

  const activeProject = projects.find((p) => p.id === activeProjectId);

  const send = async () => {
    if (!activeProjectId || !prompt.trim()) return;
    setOutput("");
    setStats(null);
    setRunning(true);
    try {
      const { job_id } = await inferenceApi.start(activeProjectId, prompt.trim());
      const disconnect = connectJsonWs<InferenceFrame>(`/ws/inference/${job_id}`, (frame) => {
        if (frame.type === "token") {
          setOutput((prev) => prev + frame.text);
        } else if (frame.type === "done") {
          setStats({ tokens: frame.tokens, tok_per_sec: frame.tok_per_sec });
          setRunning(false);
          disconnect();
        } else if (frame.type === "error") {
          Alert.alert("Inference error", frame.message);
          setRunning(false);
          disconnect();
        }
      });
    } catch (err) {
      Alert.alert("Could not start inference", String(err));
      setRunning(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Inference</Text>
        <Text style={styles.projectName}>{activeProject?.name ?? "No project selected"}</Text>
      </View>

      <TokenStreamView text={output} />

      {stats ? (
        <Text style={styles.stats}>
          {stats.tokens} tokens · {stats.tok_per_sec.toFixed(1)} tok/s
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
        <Button label="Send" onPress={send} loading={running} disabled={!activeProject?.model_filename} />
      </View>
      {!activeProject?.model_filename ? (
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
