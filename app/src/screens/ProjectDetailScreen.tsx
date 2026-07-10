import React, { useCallback, useEffect, useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, View } from "react-native";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { colors, spacing } from "../theme/colors";
import { modelsApi } from "../api/models";
import { projectsApi } from "../api/projects";
import { HistoryEntry, ModelInfo, Project } from "../api/types";

export function ProjectDetailScreen({ route, navigation }: any) {
  const { projectId } = route.params;
  const [project, setProject] = useState<Project | null>(null);
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  const load = useCallback(async () => {
    const [p, m, h] = await Promise.all([
      projectsApi.get(projectId),
      modelsApi.list(),
      projectsApi.history(projectId),
    ]);
    setProject(p);
    setModels(m);
    setHistory(h);
  }, [projectId]);

  useEffect(() => {
    load();
  }, [load]);

  const assignModel = async (filename: string) => {
    await projectsApi.update(projectId, { model_filename: filename });
    await load();
  };

  const remove = async () => {
    Alert.alert("Delete project", "This cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          await projectsApi.remove(projectId);
          navigation.goBack();
        },
      },
    ]);
  };

  if (!project) return null;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>{project.name}</Text>

      <Card>
        <Text style={styles.sectionTitle}>Model</Text>
        <Text style={styles.value}>{project.model_filename ?? "None assigned"}</Text>
        <View style={styles.modelList}>
          {models.map((m) => (
            <Text
              key={m.filename}
              onPress={() => assignModel(m.filename)}
              style={[styles.modelOption, m.filename === project.model_filename && styles.modelOptionActive]}
            >
              {m.filename}
            </Text>
          ))}
        </View>
      </Card>

      <Card>
        <Text style={styles.sectionTitle}>Inference Parameters</Text>
        <Text style={styles.value}>Temperature: {project.temperature}</Text>
        <Text style={styles.value}>Top P: {project.top_p} · Top K: {project.top_k}</Text>
        <Text style={styles.value}>Threads: {project.threads} · Context: {project.context_length}</Text>
        <Text style={styles.value}>Batch: {project.batch_size} · Max tokens: {project.max_tokens}</Text>
      </Card>

      <Card>
        <Text style={styles.sectionTitle}>History ({history.length})</Text>
        {history.slice(0, 5).map((h) => (
          <Text key={h.id} style={styles.historyLine} numberOfLines={2}>
            {h.prompt} -- {h.tokens_generated} tok @ {h.tokens_per_sec.toFixed(1)} tok/s
          </Text>
        ))}
        {history.length === 0 ? <Text style={styles.value}>No inference runs yet.</Text> : null}
      </Card>

      <Button label="Open in Inference" onPress={() => navigation.navigate("Inference", { projectId })} />
      <View style={{ height: spacing.sm }} />
      <Button label="Delete Project" onPress={remove} variant="danger" />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md },
  title: { color: colors.textPrimary, fontSize: 20, fontWeight: "700", marginBottom: spacing.md },
  sectionTitle: { color: colors.textPrimary, fontSize: 14, fontWeight: "600", marginBottom: spacing.sm },
  value: { color: colors.textSecondary, fontSize: 13, marginBottom: 2 },
  modelList: { marginTop: spacing.sm, gap: 4 },
  modelOption: { color: colors.textSecondary, fontSize: 13, paddingVertical: 4 },
  modelOptionActive: { color: colors.cpu, fontWeight: "600" },
  historyLine: { color: colors.textSecondary, fontSize: 12, marginBottom: 4, fontFamily: "monospace" },
});
