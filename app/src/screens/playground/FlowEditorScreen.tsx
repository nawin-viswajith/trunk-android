import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Text } from "../../components/Text";
import { TextInput } from "../../components/TextInput";
import { useFocusEffect } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button } from "../../components/Button";
import { CheckIndicator } from "../../components/CheckIndicator";
import { ConfirmModal } from "../../components/ConfirmModal";
import { FlowCanvas } from "../../components/flow/FlowCanvas";
import { NODE_WIDTH } from "../../components/flow/FlowNodeView";
import { listLocalModels, LocalModel } from "../../services/modelStorage";
import { selectAgent, selectFlow, useFlowStore } from "../../state/useFlowStore";
import { ColorPalette, spacing } from "../../theme/colors";
import { createScreenStyles } from "../../theme/layout";
import { useColors } from "../../theme/ThemeContext";

const MODEL_ROW_HEIGHT = 44;
const MODEL_LIST_MAX_ROWS = 5;

/** Computed purely from `flow.nodes.length`, this used to collide with an
 * existing node's stored (x,y): delete a middle node, then add a new one,
 * and the length-based slot could land exactly on a surviving node's
 * position (two cards perfectly overlapping, the older one undraggable
 * until the top one is moved). Walking forward from slot 0 and skipping any
 * slot a node already occupies guarantees a free spot regardless of which
 * node was deleted. */
function nextFreeGridSlot(nodes: { x: number; y: number }[]): { x: number; y: number } {
  const occupied = new Set(nodes.map((n) => `${n.x},${n.y}`));
  let index = 0;
  while (true) {
    const x = spacing.md + (index % 3) * (NODE_WIDTH + spacing.md);
    const y = spacing.md + Math.floor(index / 3) * 110;
    if (!occupied.has(`${x},${y}`)) return { x, y };
    index++;
  }
}

export function FlowEditorScreen({ route, navigation }: any) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { flowId } = route.params;

  const flow = useFlowStore((s) => selectFlow(s.flows, flowId));
  const agents = useFlowStore((s) => s.agents);
  const updateFlow = useFlowStore((s) => s.updateFlow);
  const addNode = useFlowStore((s) => s.addNode);
  const moveNode = useFlowStore((s) => s.moveNode);
  const removeNode = useFlowStore((s) => s.removeNode);
  const setStartNode = useFlowStore((s) => s.setStartNode);
  const connectNodes = useFlowStore((s) => s.connectNodes);
  const disconnectNode = useFlowStore((s) => s.disconnectNode);
  const removeConnection = useFlowStore((s) => s.removeConnection);

  const [models, setModels] = useState<LocalModel[]>([]);
  const [modelPickerOpen, setModelPickerOpen] = useState(false);
  const [addAgentOpen, setAddAgentOpen] = useState(false);
  const [actionSheetNodeId, setActionSheetNodeId] = useState<string | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  useFocusEffect(
    useCallback(() => {
      listLocalModels().then(setModels);
    }, [])
  );

  if (!flow) return null;

  const assignModel = (filename: string) => {
    updateFlow(flow.id, { modelFilename: filename });
    setModelPickerOpen(false);
  };

  const handleAddAgent = (agentId: string) => {
    const { x, y } = nextFreeGridSlot(flow.nodes);
    addNode(flow.id, agentId, x, y);
    setAddAgentOpen(false);
  };

  // `models` is refreshed on focus (see the useFocusEffect above), so this
  // catches a model that was deleted from the Models tab since this flow was
  // last configured — without it, Run stays enabled with a stale filename
  // and the only feedback is a raw file-path error thrown from deep inside
  // ensureLoaded once the user has already typed input and pressed Run.
  const modelMissing = !!flow.modelFilename && !models.some((m) => m.filename === flow.modelFilename);
  const canRun = !!flow.modelFilename && !!flow.startNodeId && !modelMissing;

  const actionSheetNode = actionSheetNodeId ? flow.nodes.find((n) => n.id === actionSheetNodeId) : undefined;

  return (
    <View style={styles.container}>
      <View style={[styles.topBar, { paddingTop: Math.max(spacing.sm, insets.top) }]}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12} style={styles.backButton}>
          <Text style={styles.backButtonLabel}>‹</Text>
        </Pressable>
        <Text style={styles.flowName} numberOfLines={1}>
          {flow.name}
        </Text>
        <Pressable
          onPress={() => navigation.navigate("Run Flow", { flowId: flow.id })}
          disabled={!canRun}
          style={({ pressed }) => [styles.runButton, !canRun && styles.runButtonDisabled, pressed && canRun && styles.runButtonPressed]}
        >
          <Text style={[styles.runButtonLabel, !canRun && styles.runButtonLabelDisabled]}>▶ Run</Text>
        </Pressable>
      </View>

      <Pressable onPress={() => setModelPickerOpen((v) => !v)} style={styles.modelChip}>
        <Text style={[styles.modelChipLabel, modelMissing && styles.modelChipLabelWarning]} numberOfLines={1}>
          {modelMissing
            ? `Model: ${flow.modelFilename} (no longer downloaded - pick another)`
            : flow.modelFilename
              ? `Model: ${flow.modelFilename}`
              : "No model assigned - tap to choose"}
        </Text>
        <Text style={styles.modelChipCaret}>{modelPickerOpen ? "▲" : "▼"}</Text>
      </Pressable>

      {modelPickerOpen ? (
        <ScrollView
          style={[
            styles.modelList,
            { maxHeight: Math.max(1, Math.min(models.length, MODEL_LIST_MAX_ROWS)) * MODEL_ROW_HEIGHT },
          ]}
        >
          {models.map((m) => {
            const active = m.filename === flow.modelFilename;
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
          {models.length === 0 ? <Text style={styles.modelEmpty}>No models downloaded yet.</Text> : null}
        </ScrollView>
      ) : null}

      <FlowCanvas
        flow={flow}
        agents={agents}
        onMoveNode={(nodeId, x, y) => moveNode(flow.id, nodeId, x, y)}
        onConnect={(sourceId, targetId) => connectNodes(flow.id, sourceId, targetId)}
        onRemoveConnection={(sourceId) => removeConnection(flow.id, sourceId)}
        onNodeLongPress={(nodeId) => setActionSheetNodeId(nodeId)}
      />

      <Pressable style={styles.fab} onPress={() => setAddAgentOpen(true)}>
        <Text style={styles.fabLabel}>+</Text>
      </Pressable>

      <Modal visible={addAgentOpen} transparent animationType="fade" onRequestClose={() => setAddAgentOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setAddAgentOpen(false)}>
          <Pressable style={styles.sheetCard} onPress={() => {}}>
            <Text style={styles.sheetTitle}>Add Agent</Text>
            <ScrollView style={styles.agentPickList}>
              {agents.map((a) => (
                <Pressable key={a.id} onPress={() => handleAddAgent(a.id)} style={styles.agentPickRow}>
                  <Text style={styles.agentPickLabel} numberOfLines={1}>
                    {a.name}
                  </Text>
                </Pressable>
              ))}
              {agents.length === 0 ? (
                <View>
                  <Text style={styles.modelEmpty}>No agents yet.</Text>
                  <Pressable
                    onPress={() => {
                      setAddAgentOpen(false);
                      navigation.navigate("Agent Library");
                    }}
                  >
                    <Text style={styles.agentLibraryLink}>Create one in the Agent Library ›</Text>
                  </Pressable>
                </View>
              ) : null}
            </ScrollView>
            <Button label="Cancel" onPress={() => setAddAgentOpen(false)} variant="neutral" />
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={!!actionSheetNode} transparent animationType="fade" onRequestClose={() => setActionSheetNodeId(null)}>
        <Pressable style={styles.backdrop} onPress={() => setActionSheetNodeId(null)}>
          <Pressable style={styles.sheetCard} onPress={() => {}}>
            <Text style={styles.sheetTitle}>
              {actionSheetNode ? selectAgent(agents, actionSheetNode.agentId)?.name ?? "Node" : ""}
            </Text>
            <View style={styles.sheetButtonGap}>
              <Button
                label="Set as Start"
                onPress={() => {
                  if (actionSheetNodeId) setStartNode(flow.id, actionSheetNodeId);
                  setActionSheetNodeId(null);
                }}
                variant="secondary"
              />
            </View>
            <View style={styles.sheetButtonGap}>
              <Button
                label="Remove Connections"
                onPress={() => {
                  if (actionSheetNodeId) disconnectNode(flow.id, actionSheetNodeId);
                  setActionSheetNodeId(null);
                }}
                variant="neutral"
              />
            </View>
            <View style={styles.sheetButtonGap}>
              <Button label="Delete Node" onPress={() => setDeleteConfirmOpen(true)} variant="danger" />
            </View>
            <Button label="Cancel" onPress={() => setActionSheetNodeId(null)} variant="neutral" />
          </Pressable>
        </Pressable>
      </Modal>

      <ConfirmModal
        visible={deleteConfirmOpen}
        title="Delete node"
        message="This removes the agent from this flow and breaks its connections."
        confirmLabel="Delete"
        destructive
        onConfirm={() => {
          if (actionSheetNodeId) removeNode(flow.id, actionSheetNodeId);
          setDeleteConfirmOpen(false);
          setActionSheetNodeId(null);
        }}
        onCancel={() => setDeleteConfirmOpen(false)}
      />
    </View>
  );
}

function createStyles(colors: ColorPalette) {
  const screen = createScreenStyles(colors);
  return StyleSheet.create({
    container: screen.container,
    topBar: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      backgroundColor: colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.sm,
    },
    backButton: { paddingHorizontal: spacing.sm },
    backButtonLabel: { color: colors.accent, fontSize: 28, fontWeight: "700" },
    flowName: { flex: 1, color: colors.textPrimary, fontSize: 16, fontWeight: "700", marginHorizontal: spacing.sm },
    runButton: { borderWidth: 1, borderColor: colors.accent, paddingVertical: 6, paddingHorizontal: spacing.sm },
    runButtonPressed: { backgroundColor: colors.accent + "22" },
    runButtonDisabled: { borderColor: colors.border },
    runButtonLabel: { color: colors.accent, fontSize: 12, fontWeight: "700" },
    runButtonLabelDisabled: { color: colors.textSecondary },
    modelChip: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      backgroundColor: colors.surface,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
    },
    modelChipLabel: { flex: 1, color: colors.textSecondary, fontSize: 12, fontFamily: "monospace", marginRight: spacing.sm },
    modelChipLabelWarning: { color: colors.error },
    modelChipCaret: { color: colors.textSecondary, fontSize: 10 },
    modelList: { backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
    modelOption: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      height: MODEL_ROW_HEIGHT,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      borderLeftWidth: 3,
      borderLeftColor: "transparent",
      paddingHorizontal: spacing.sm,
    },
    modelOptionActive: { borderLeftColor: colors.accentTertiary, backgroundColor: colors.accent + "22" },
    modelOptionLabel: { color: colors.textSecondary, fontSize: 13, fontFamily: "monospace", flexShrink: 1, marginRight: spacing.sm },
    modelOptionLabelActive: { color: colors.accent, fontWeight: "600" },
    modelEmpty: { color: colors.textSecondary, fontSize: 13, padding: spacing.sm },
    agentLibraryLink: { color: colors.accentSecondary, fontSize: 13, fontWeight: "600", paddingHorizontal: spacing.sm, paddingBottom: spacing.sm },
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
    backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "center", padding: spacing.lg },
    sheetCard: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderTopWidth: 3,
      borderTopColor: colors.accent,
      padding: spacing.lg,
      maxHeight: "70%",
    },
    sheetTitle: { color: colors.textPrimary, fontSize: 17, fontWeight: "700", marginBottom: spacing.md },
    sheetButtonGap: { marginBottom: spacing.sm },
    agentPickList: { marginBottom: spacing.md },
    agentPickRow: { borderTopWidth: 1, borderTopColor: colors.border, paddingVertical: spacing.sm },
    agentPickLabel: { color: colors.textPrimary, fontSize: 14, fontWeight: "600" },
  });
}
