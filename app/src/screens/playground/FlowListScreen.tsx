import React, { useMemo, useState } from "react";
import { FlatList, Pressable, StyleSheet, View } from "react-native";
import { Text } from "../../components/Text";
import { TextInput } from "../../components/TextInput";
import { ConfirmModal } from "../../components/ConfirmModal";
import { CreateFlowModal } from "../../components/flow/CreateFlowModal";
import { FlowCard } from "../../components/flow/FlowCard";
import { GuideStep } from "../../components/PageGuideModal";
import { ScreenHeader } from "../../components/ScreenHeader";
import { StatsBar } from "../../components/StatsBar";
import { ColorPalette, spacing } from "../../theme/colors";
import { createScreenStyles } from "../../theme/layout";
import { useColors } from "../../theme/ThemeContext";
import { useFlowStore } from "../../state/useFlowStore";
import { fuzzyMatch } from "../../utils/fuzzy";

const GUIDE_STEPS: GuideStep[] = [
  {
    title: "Agents vs Flows",
    description: "An Agent is a reusable persona — a name plus a system prompt. A Flow wires several Agents together into a linear chain.",
  },
  {
    title: "Build your Agent library",
    description: "Tap Manage Agents to write a system prompt yourself, or describe the agent's purpose and let the currently-loaded model draft one for you (Craft with AI).",
  },
  {
    title: "Wire a Flow",
    description: "Tap + then New Flow, add Agents as nodes on the canvas, drag to arrange them, and tap an output handle then an input handle to connect them in order.",
  },
  {
    title: "Run the chain",
    description: "Assign a model and generation settings to the flow, then run it — watch each agent work and stream its response live, ending in one final combined result.",
  },
];

export function FlowListScreen({ navigation }: any) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const flows = useFlowStore((s) => s.flows);
  const agents = useFlowStore((s) => s.agents);
  const createFlow = useFlowStore((s) => s.createFlow);
  const deleteFlow = useFlowStore((s) => s.deleteFlow);
  const [query, setQuery] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [fabMenuOpen, setFabMenuOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const selectionMode = selectedIds.size > 0;

  const filteredFlows = useMemo(() => {
    if (!query.trim()) return flows;
    return flows.filter((f) => fuzzyMatch(f.name, query));
  }, [flows, query]);

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
    selectedIds.forEach((id) => deleteFlow(id));
    setSelectedIds(new Set());
    setDeleteConfirmOpen(false);
  };

  const handleCreate = (name: string) => {
    const flow = createFlow(name);
    navigation.navigate("Flow Editor", { flowId: flow.id });
  };

  return (
    <View style={styles.container}>
      <ScreenHeader title="Playground" showActions guideSteps={GUIDE_STEPS} />
      {flows.length > 0 ? (
        <View style={styles.toolbar}>
          <View style={styles.searchRow}>
            <Text style={styles.searchIcon}>⌕</Text>
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search flows"
              placeholderTextColor={colors.textSecondary}
              style={styles.search}
              autoCapitalize="none"
            />
            {query.length > 0 ? (
              <Pressable onPress={() => setQuery("")} hitSlop={10} style={styles.clearButton}>
                <Text style={styles.clearButtonLabel}>×</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      ) : null}

      <FlatList
        style={styles.flatList}
        data={filteredFlows}
        keyExtractor={(item) => item.id}
        contentContainerStyle={filteredFlows.length === 0 ? styles.emptyListContent : styles.list}
        renderItem={({ item }) => (
          <FlowCard
            flow={item}
            selectionMode={selectionMode}
            selected={selectedIds.has(item.id)}
            onPress={() =>
              selectionMode ? toggleSelected(item.id) : navigation.navigate("Flow Editor", { flowId: item.id })
            }
            onLongPress={() => toggleSelected(item.id)}
          />
        )}
        ListEmptyComponent={
          flows.length === 0 ? (
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyTitle}>No flows yet</Text>
              <Text style={styles.emptySubtitle}>Tap + to wire up your first agent chain.</Text>
            </View>
          ) : (
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyTitle}>No matches</Text>
              <Text style={styles.emptySubtitle}>No flows match "{query}".</Text>
            </View>
          )
        }
      />

      {!selectionMode ? (
        <StatsBar
          left={`${flows.length} flow${flows.length === 1 ? "" : "s"}`}
          right={`${agents.length} agent${agents.length === 1 ? "" : "s"}`}
        />
      ) : null}

      <CreateFlowModal visible={createOpen} onClose={() => setCreateOpen(false)} onCreate={handleCreate} />

      {fabMenuOpen ? (
        <Pressable style={styles.backdrop} onPress={() => setFabMenuOpen(false)}>
          <View style={styles.menu}>
            <Pressable
              style={styles.menuItem}
              onPress={() => {
                setFabMenuOpen(false);
                setCreateOpen(true);
              }}
            >
              <Text style={styles.menuItemLabel}>New Flow</Text>
            </Pressable>
            <View style={styles.menuDivider} />
            <Pressable
              style={styles.menuItem}
              onPress={() => {
                setFabMenuOpen(false);
                navigation.navigate("Agent Library");
              }}
            >
              <Text style={styles.menuItemLabel}>Manage Agents</Text>
            </Pressable>
          </View>
        </Pressable>
      ) : null}

      <ConfirmModal
        visible={deleteConfirmOpen}
        title={`Delete ${selectedIds.size} flow${selectedIds.size === 1 ? "" : "s"}?`}
        message="This cannot be undone."
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
        <Pressable style={styles.fab} onPress={() => setFabMenuOpen((v) => !v)}>
          <Text style={styles.fabLabel}>{fabMenuOpen ? "×" : "+"}</Text>
        </Pressable>
      )}
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
    fab: {
      position: "absolute",
      right: spacing.md,
      bottom: spacing.lg + 40,
      width: 52,
      height: 52,
      borderRadius: 26,
      backgroundColor: colors.accent,
      alignItems: "center",
      justifyContent: "center",
    },
    fabLabel: { color: colors.background, fontSize: 26, fontWeight: "700", lineHeight: 28 },
    backdrop: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },
    menu: {
      position: "absolute",
      right: spacing.md,
      bottom: spacing.lg + 40 + 52 + spacing.sm,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      minWidth: 200,
    },
    menuItem: { paddingVertical: spacing.md, paddingHorizontal: spacing.md },
    menuItemLabel: { color: colors.textPrimary, fontSize: 14, fontWeight: "600" },
    menuDivider: { height: 1, backgroundColor: colors.border },
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
