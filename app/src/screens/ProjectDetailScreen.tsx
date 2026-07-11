import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, View } from "react-native";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { ColorPalette, spacing } from "../theme/colors";
import { useColors } from "../theme/ThemeContext";
import { useProjectStore, selectProject, selectHistoryForProject } from "../state/useProjectStore";
import { listLocalModels, LocalModel } from "../services/modelStorage";

export function ProjectDetailScreen({ route, navigation }: any) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { projectId } = route.params;

  const project = useProjectStore((s) => selectProject(s.projects, projectId));
  const history = useProjectStore((s) => selectHistoryForProject(s.history, projectId));
  const updateProject = useProjectStore((s) => s.updateProject);
  const deleteProject = useProjectStore((s) => s.deleteProject);
  const [models, setModels] = useState<LocalModel[]>([]);

  const load = useCallback(async () => {
    setModels(await listLocalModels());
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const assignModel = (filename: string) => {
    updateProject(projectId, { modelFilename: filename });
  };

  const remove = () => {
    Alert.alert("Delete project", "This cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          deleteProject(projectId);
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
        <Text style={styles.value}>{project.modelFilename ?? "None assigned"}</Text>
        <View style={styles.modelList}>
          {models.map((m) => (
            <Text
              key={m.filename}
              onPress={() => assignModel(m.filename)}
              style={[styles.modelOption, m.filename === project.modelFilename && styles.modelOptionActive]}
            >
              {m.filename}
            </Text>
          ))}
          {models.length === 0 ? <Text style={styles.value}>No models downloaded yet (Models tab).</Text> : null}
        </View>
      </Card>

      <Card>
        <Text style={styles.sectionTitle}>Inference Parameters</Text>
        <Text style={styles.value}>Temperature: {project.temperature}</Text>
        <Text style={styles.value}>Top P: {project.topP} · Top K: {project.topK}</Text>
        <Text style={styles.value}>Context: {project.contextLength} · Max tokens: {project.maxTokens}</Text>
      </Card>

      <Card>
        <Text style={styles.sectionTitle}>History ({history.length})</Text>
        {history.slice(0, 5).map((h) => (
          <Text key={h.id} style={styles.historyLine} numberOfLines={2}>
            {h.prompt} -- {h.tokensGenerated} tok @ {h.tokensPerSecond.toFixed(1)} tok/s
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

function createStyles(colors: ColorPalette) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    content: { padding: spacing.md },
    title: { color: colors.textPrimary, fontSize: 20, fontWeight: "700", marginBottom: spacing.md },
    sectionTitle: { color: colors.textPrimary, fontSize: 14, fontWeight: "600", marginBottom: spacing.sm },
    value: { color: colors.textSecondary, fontSize: 13, marginBottom: 2 },
    modelList: { marginTop: spacing.sm, gap: 4 },
    modelOption: { color: colors.textSecondary, fontSize: 13, paddingVertical: 4, fontFamily: "monospace" },
    modelOptionActive: { color: colors.cpu, fontWeight: "600" },
    historyLine: { color: colors.textSecondary, fontSize: 12, marginBottom: 4, fontFamily: "monospace" },
  });
}
