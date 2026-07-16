import React, { useCallback, useEffect, useMemo, useState } from "react";
import { FlatList, Pressable, StyleSheet, View } from "react-native";
import { Text } from "../components/Text";
import { TextInput } from "../components/TextInput";
import { ConfirmModal } from "../components/ConfirmModal";
import { CreateProjectModal, NewProjectParams } from "../components/CreateProjectModal";
import { GuideStep } from "../components/PageGuideModal";
import { ProjectCard } from "../components/ProjectCard";
import { ScreenHeader } from "../components/ScreenHeader";
import { AddTile } from "../components/AddTile";
import { StatsBar } from "../components/StatsBar";
import { ColorPalette, spacing } from "../theme/colors";
import { createScreenStyles } from "../theme/layout";
import { useColors } from "../theme/ThemeContext";
import { useProjectStore } from "../state/useProjectStore";
import { listLocalModels, LocalModel, filterUsableChatModels } from "../services/modelStorage";
import { fuzzyMatch } from "../utils/fuzzy";

const GUIDE_STEPS: GuideStep[] = [
  {
    title: "What's a project",
    description: "A project binds a downloaded model to a set of generation settings - temperature, top-p, top-k, context length, max tokens.",
  },
  {
    title: "Create one",
    description: "Tap \"New Project\" to name a project, pick a downloaded model, and tune its generation settings.",
  },
  {
    title: "Open it up",
    description: "Tap a project to review or edit its settings, run a benchmark, or jump into Inference to chat with it.",
  },
  {
    title: "Manage",
    description: "Hold a project to select it (and others) for bulk delete - this also removes its chat history.",
  },
];

export function ProjectsScreen({ navigation }: any) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const projects = useProjectStore((s) => s.projects);
  const sessions = useProjectStore((s) => s.sessions);
  const createProject = useProjectStore((s) => s.createProject);
  const updateProject = useProjectStore((s) => s.updateProject);
  const deleteProject = useProjectStore((s) => s.deleteProject);
  const [query, setQuery] = useState("");
  const [models, setModels] = useState<LocalModel[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const selectionMode = selectedIds.size > 0;

  useEffect(() => {
    listLocalModels().then((list) => setModels(filterUsableChatModels(list)));
    const unsubscribe = navigation.addListener("focus", () => listLocalModels().then((list) => setModels(filterUsableChatModels(list))));
    return unsubscribe;
  }, [navigation]);

  const filteredProjects = useMemo(() => {
    if (!query.trim()) return projects;
    return projects.filter((p) => fuzzyMatch(p.name, query));
  }, [projects, query]);

  const handleCreate = useCallback(
    (params: NewProjectParams) => {
      const project = createProject(params.name, params.modelFilename);
      updateProject(project.id, {
        temperature: params.temperature,
        topP: params.topP,
        topK: params.topK,
        contextLength: params.contextLength,
        maxTokens: params.maxTokens,
      });
    },
    [createProject, updateProject]
  );

  const toggleSelected = (id: string) => {
    setSelectedIds((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const cancelSelection = () => setSelectedIds(new Set());

  const confirmBulkDelete = () => {
    selectedIds.forEach((id) => deleteProject(id));
    setSelectedIds(new Set());
    setDeleteConfirmOpen(false);
  };

  return (
    <View style={styles.container}>
      <ScreenHeader title="Projects" showActions guideSteps={GUIDE_STEPS} />
      <AddTile label="New Project" onPress={() => setCreateOpen(true)} />
      {projects.length > 0 ? (
        <View style={styles.toolbar}>
          <View style={styles.searchRow}>
            <Text style={styles.searchIcon}>{`\u2315`}</Text>
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search projects"
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
        </View>
      ) : null}
      <FlatList
        style={styles.flatList}
        data={filteredProjects}
        keyExtractor={(item) => item.id}
        contentContainerStyle={filteredProjects.length === 0 ? styles.emptyListContent : styles.list}
        renderItem={({ item }) => (
          <ProjectCard
            project={item}
            selectionMode={selectionMode}
            selected={selectedIds.has(item.id)}
            onPress={() =>
              selectionMode
                ? toggleSelected(item.id)
                : navigation.navigate("Project Detail", { projectId: item.id })
            }
            onLongPress={() => toggleSelected(item.id)}
          />
        )}
        ListEmptyComponent={
          projects.length === 0 ? (
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyTitle}>No projects yet</Text>
              <Text style={styles.emptySubtitle}>Tap "New Project" to create one.</Text>
            </View>
          ) : (
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyTitle}>No matches</Text>
              <Text style={styles.emptySubtitle}>No projects match "{query}".</Text>
            </View>
          )
        }
      />

      {!selectionMode ? (
        <StatsBar
          left={`${projects.length} project${projects.length === 1 ? "" : "s"}`}
          right={`${sessions.length} chat session${sessions.length === 1 ? "" : "s"}`}
        />
      ) : null}

      <CreateProjectModal visible={createOpen} onClose={() => setCreateOpen(false)} models={models} onCreate={handleCreate} />

      <ConfirmModal
        visible={deleteConfirmOpen}
        title={`Delete ${selectedIds.size} project${selectedIds.size === 1 ? "" : "s"}?`}
        message="This cannot be undone. Their chat history will be deleted too."
        confirmLabel="Delete"
        destructive
        onConfirm={confirmBulkDelete}
        onCancel={() => setDeleteConfirmOpen(false)}
      />

      {selectionMode ? (
        <View style={styles.selectionBar}>
          <Pressable style={styles.cancelChip} onPress={cancelSelection}>
            <Text style={styles.cancelChipLabel}>Cancel</Text>
          </Pressable>
          <Pressable style={styles.deleteChip} onPress={() => setDeleteConfirmOpen(true)}>
            <Text style={styles.deleteChipLabel}>Delete ({selectedIds.size})</Text>
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
    search: { flex: 1, color: colors.textPrimary, paddingVertical: spacing.sm },
    clearButton: { paddingHorizontal: spacing.xs, paddingVertical: spacing.xs },
    clearButtonLabel: { color: colors.textSecondary, fontSize: 16, fontWeight: "700" },
    flatList: { flex: 1 },
    list: { paddingHorizontal: spacing.md, paddingBottom: spacing.xl * 2 },
    emptyListContent: { flexGrow: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: spacing.md },
    emptyWrap: { alignItems: "center", gap: spacing.xs },
    emptyTitle: { color: colors.textPrimary, fontSize: 18, fontWeight: "700", textAlign: "center" },
    emptySubtitle: { color: colors.textSecondary, fontSize: 13, textAlign: "center" },
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
