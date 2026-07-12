import React, { useEffect, useMemo, useState } from "react";
import { FlatList, Pressable, StyleSheet, View } from "react-native";
import { Text } from "../../components/Text";
import { AgentCard } from "../../components/flow/AgentCard";
import { AgentEditorModal } from "../../components/flow/AgentEditorModal";
import { ConfirmModal } from "../../components/ConfirmModal";
import { Agent, selectAgent, useFlowStore } from "../../state/useFlowStore";
import { ColorPalette, spacing } from "../../theme/colors";
import { createScreenStyles } from "../../theme/layout";
import { useColors } from "../../theme/ThemeContext";

export function AgentLibraryScreen({ navigation, route }: any) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const agents = useFlowStore((s) => s.agents);
  const createAgent = useFlowStore((s) => s.createAgent);
  const updateAgent = useFlowStore((s) => s.updateAgent);
  const deleteAgent = useFlowStore((s) => s.deleteAgent);

  const [editorOpen, setEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const selectionMode = selectedIds.size > 0;

  const editingAgent: Agent | undefined = editingId ? selectAgent(agents, editingId) : undefined;

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
    selectedIds.forEach((id) => deleteAgent(id));
    setSelectedIds(new Set());
    setDeleteConfirmOpen(false);
  };

  const openCreate = () => {
    setEditingId(null);
    setEditorOpen(true);
  };

  useEffect(() => {
    if (route?.params?.openCreate) {
      openCreate();
      navigation.setParams({ openCreate: undefined });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route?.params?.openCreate]);

  const openEdit = (id: string) => {
    setEditingId(id);
    setEditorOpen(true);
  };

  const handleSave = (name: string, systemPrompt: string) => {
    if (editingId) {
      updateAgent(editingId, { name, systemPrompt });
    } else {
      createAgent(name, systemPrompt);
    }
    setEditorOpen(false);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.subtitle}>Reusable personas for your flows</Text>

      <FlatList
        style={styles.flatList}
        data={agents}
        keyExtractor={(item) => item.id}
        contentContainerStyle={agents.length === 0 ? styles.emptyListContent : styles.list}
        renderItem={({ item }) => (
          <AgentCard
            agent={item}
            selectionMode={selectionMode}
            selected={selectedIds.has(item.id)}
            onPress={() => (selectionMode ? toggleSelected(item.id) : openEdit(item.id))}
            onLongPress={() => toggleSelected(item.id)}
          />
        )}
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyTitle}>No agents yet</Text>
            <Text style={styles.emptySubtitle}>Tap + to define a persona for your flows.</Text>
          </View>
        }
      />

      <AgentEditorModal visible={editorOpen} agent={editingAgent} onClose={() => setEditorOpen(false)} onSave={handleSave} />

      <ConfirmModal
        visible={deleteConfirmOpen}
        title={`Delete ${selectedIds.size} agent${selectedIds.size === 1 ? "" : "s"}?`}
        message="Any flow nodes using these agents will be removed too."
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
      ) : (
        <Pressable style={styles.fab} onPress={openCreate}>
          <Text style={styles.fabLabel}>+</Text>
        </Pressable>
      )}
    </View>
  );
}

function createStyles(colors: ColorPalette) {
  const screen = createScreenStyles(colors);
  return StyleSheet.create({
    container: screen.container,
    subtitle: { color: colors.textSecondary, fontSize: 12, padding: spacing.md, paddingBottom: spacing.sm },
    flatList: { flex: 1 },
    list: { paddingHorizontal: spacing.md, paddingBottom: spacing.xl * 2 },
    emptyListContent: { flexGrow: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: spacing.md },
    emptyWrap: { alignItems: "center", gap: spacing.xs },
    emptyTitle: { color: colors.textPrimary, fontSize: 18, fontWeight: "700", textAlign: "center" },
    emptySubtitle: { color: colors.textSecondary, fontSize: 13, textAlign: "center" },
    fab: {
      position: "absolute",
      right: spacing.md,
      bottom: spacing.lg,
      width: 52,
      height: 52,
      borderRadius: 26,
      backgroundColor: colors.accent,
      alignItems: "center",
      justifyContent: "center",
    },
    fabLabel: { color: colors.background, fontSize: 26, fontWeight: "700", lineHeight: 28 },
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
