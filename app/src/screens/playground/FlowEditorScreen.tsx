import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Text } from "../../components/Text";
import { TextInput } from "../../components/TextInput";
import { useFocusEffect } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button } from "../../components/Button";
import { CheckIndicator } from "../../components/CheckIndicator";
import { ConfirmModal } from "../../components/ConfirmModal";
import { AddTile } from "../../components/AddTile";
import { FlowCanvas } from "../../components/flow/FlowCanvas";
import { NODE_WIDTH, NODE_HEIGHT } from "../../components/flow/FlowNodeView";
import { listLocalModels, LocalModel, filterUsableChatModels } from "../../services/modelStorage";
import { selectAgent, selectFlow, useFlowStore } from "../../state/useFlowStore";
import { useSuppressTabSwipe } from "../../navigation/SwipeableScreen";
import { parseInferenceParams, INFERENCE_PARAM_HINT } from "../../utils/inferenceParams";
import { showAlert } from "../../state/useAlertStore";
import { ColorPalette, spacing } from "../../theme/colors";
import { createScreenStyles } from "../../theme/layout";
import { useColors } from "../../theme/ThemeContext";

const MODEL_ROW_HEIGHT = 44;
const MODEL_LIST_MAX_ROWS = 5;
const NODE_GAP = spacing.md;

function rectsOverlap(ax: number, ay: number, bx: number, by: number): boolean {
  const pad = 8;
  return ax < bx + NODE_WIDTH + pad && ax + NODE_WIDTH + pad > bx && ay < by + NODE_HEIGHT + pad && ay + NODE_HEIGHT + pad > by;
}

/** Places a new node at the center of whatever the user is currently looking
 * at (accounting for how far they've panned the canvas), not a fixed
 * canvas-space origin — otherwise "+" after panning away from (0,0) adds a
 * node that's silently off-screen until the user happens to pan back over
 * it. Searches outward in a ring pattern for a free spot if the center is
 * occupied, and only falls back to a cascading stack (each new node offset
 * a little further) once the search radius is exhausted. */
function nextNodeSlot(
  nodes: { x: number; y: number }[],
  center: { x: number; y: number }
): { x: number; y: number } {
  const startX = Math.round(center.x - NODE_WIDTH / 2);
  const startY = Math.round(center.y - NODE_HEIGHT / 2);
  if (!nodes.some((n) => rectsOverlap(startX, startY, n.x, n.y))) return { x: startX, y: startY };

  const stepX = NODE_WIDTH + NODE_GAP;
  const stepY = NODE_HEIGHT + NODE_GAP;
  const MAX_RING = 6;
  for (let ring = 1; ring <= MAX_RING; ring++) {
    for (let dx = -ring; dx <= ring; dx++) {
      for (let dy = -ring; dy <= ring; dy++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== ring) continue; // only this ring's perimeter
        const x = startX + dx * stepX;
        const y = startY + dy * stepY;
        if (!nodes.some((n) => rectsOverlap(x, y, n.x, n.y))) return { x, y };
      }
    }
  }

  // Every nearby spot is occupied — stack in place with a small cascading
  // offset so each new card still peeks out from behind the last one
  // instead of perfectly hiding it.
  const cascade = nodes.length % 6;
  return { x: startX + cascade * 16, y: startY + cascade * 16 };
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
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [addAgentOpen, setAddAgentOpen] = useState(false);
  const [actionSheetNodeId, setActionSheetNodeId] = useState<string | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  const [temperature, setTemperature] = useState(String(flow?.temperature ?? 0.7));
  const [topP, setTopP] = useState(String(flow?.topP ?? 0.9));
  const [topK, setTopK] = useState(String(flow?.topK ?? 40));
  const [contextLength, setContextLength] = useState(String(flow?.contextLength ?? 2048));
  const [maxTokens, setMaxTokens] = useState(String(flow?.maxTokens ?? 512));
  const [justApplied, setJustApplied] = useState(false);

  useEffect(() => {
    if (!flow) return;
    setTemperature(String(flow.temperature));
    setTopP(String(flow.topP));
    setTopK(String(flow.topK));
    setContextLength(String(flow.contextLength));
    setMaxTokens(String(flow.maxTokens));
  }, [flow?.id]);
  const viewportRef = useRef({ offset: { x: 0, y: 0 }, width: 0, height: 0 });

  // A fast pan across the canvas can otherwise register as a fling on the
  // ancestor SwipeableScreen (every root tab supports fling-to-switch) and
  // yank the user over to Inference or Projects mid-drag.
  useSuppressTabSwipe(true);

  useFocusEffect(
    useCallback(() => {
      listLocalModels().then((list) => setModels(filterUsableChatModels(list)));
    }, [])
  );

  if (!flow) return null;

  const assignModel = (filename: string) => {
    updateFlow(flow.id, { modelFilename: filename });
    setModelPickerOpen(false);
  };

  // Only applies when this flow is run standalone from here or Run Flow -
  // "Run via Flow" inside a Project's Inference session uses that
  // project's own settings instead (see FlowRunOverrides in flowRunner.ts).
  const applyParams = () => {
    const parsed = parseInferenceParams({ temperature, topP, topK, contextLength, maxTokens });
    if (!parsed) {
      showAlert("Invalid values", INFERENCE_PARAM_HINT);
      return;
    }
    updateFlow(flow.id, parsed);
    setJustApplied(true);
    setTimeout(() => setJustApplied(false), 1800);
  };

  const onParamFieldChange = (setter: (v: string) => void) => (value: string) => {
    setJustApplied(false);
    setter(value);
  };

  const handleAddAgent = (agentId: string) => {
    const { offset, width, height } = viewportRef.current;
    const center =
      width > 0 && height > 0
        ? { x: width / 2 - offset.x, y: height / 2 - offset.y }
        : { x: spacing.md + NODE_WIDTH / 2, y: spacing.md + NODE_HEIGHT / 2 };
    const { x, y } = nextNodeSlot(flow.nodes, center);
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
        <View style={styles.flowNameWrap}>
          <Text style={styles.flowName} numberOfLines={1}>
            {flow.name}
          </Text>
          <Text style={styles.agentCount}>
            {flow.nodes.length} agent{flow.nodes.length === 1 ? "" : "s"}
          </Text>
        </View>
        <Pressable
          onPress={() => navigation.navigate("Run Flow", { flowId: flow.id })}
          disabled={!canRun}
          style={({ pressed }) => [styles.runButton, !canRun && styles.runButtonDisabled, pressed && canRun && styles.runButtonPressed]}
        >
          <Text style={[styles.runButtonLabel, !canRun && styles.runButtonLabelDisabled]}>{"\u25B6"} Run</Text>
        </Pressable>
      </View>

      <AddTile label="Add Agent to Canvas" onPress={() => setAddAgentOpen(true)} />

      {/* A flow with no model assigned can't ever run, and previously this
       * read as a subdued, easy-to-miss line of small monospace text — the
       * same visual weight as any other secondary label on the screen, for
       * what is actually a required, blocking setting. */}
      <Pressable
        onPress={() => setModelPickerOpen((v) => !v)}
        style={[styles.modelChip, modelMissing && styles.modelChipWarning, !flow.modelFilename && styles.modelChipEmpty]}
      >
        <Text style={styles.modelChipEyebrow}>MODEL</Text>
        <Text style={[styles.modelChipLabel, modelMissing && styles.modelChipLabelWarning]} numberOfLines={1}>
          {modelMissing
            ? `${flow.modelFilename} — no longer downloaded, tap to pick another`
            : flow.modelFilename
              ? flow.modelFilename
              : "No model assigned — tap to choose one"}
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

      <Pressable onPress={() => setSettingsOpen((v) => !v)} style={styles.modelChip}>
        <Text style={styles.modelChipEyebrow}>SETTINGS</Text>
        <Text style={styles.modelChipLabel} numberOfLines={1}>
          temp {flow.temperature} · topP {flow.topP} · topK {flow.topK} · ctx {flow.contextLength} · max {flow.maxTokens}
        </Text>
        <Text style={styles.modelChipCaret}>{settingsOpen ? "▲" : "▼"}</Text>
      </Pressable>

      {settingsOpen ? (
        <View style={styles.settingsPanel}>
          <Text style={styles.settingsNote}>
            Only used when this flow runs standalone (here or Run Flow) — a project's own settings win when running via
            Flow from its Inference chat.
          </Text>
          <View style={styles.paramRow}>
            <Text style={styles.paramLabel}>Temperature</Text>
            <TextInput
              value={temperature}
              onChangeText={onParamFieldChange(setTemperature)}
              keyboardType="decimal-pad"
              style={styles.paramInput}
            />
          </View>
          <View style={styles.paramRow}>
            <Text style={styles.paramLabel}>Top P</Text>
            <TextInput value={topP} onChangeText={onParamFieldChange(setTopP)} keyboardType="decimal-pad" style={styles.paramInput} />
          </View>
          <View style={styles.paramRow}>
            <Text style={styles.paramLabel}>Top K</Text>
            <TextInput value={topK} onChangeText={onParamFieldChange(setTopK)} keyboardType="number-pad" style={styles.paramInput} />
          </View>
          <View style={styles.paramRow}>
            <Text style={styles.paramLabel}>Context length</Text>
            <TextInput
              value={contextLength}
              onChangeText={onParamFieldChange(setContextLength)}
              keyboardType="number-pad"
              style={styles.paramInput}
            />
          </View>
          <View style={styles.paramRow}>
            <Text style={styles.paramLabel}>Max tokens</Text>
            <TextInput
              value={maxTokens}
              onChangeText={onParamFieldChange(setMaxTokens)}
              keyboardType="number-pad"
              style={styles.paramInput}
            />
          </View>
          <Button
            label={justApplied ? "Applied ✓" : "Apply Settings"}
            onPress={applyParams}
            variant={justApplied ? "primary" : "secondary"}
            disabled={justApplied}
          />
        </View>
      ) : null}

      <FlowCanvas
        flow={flow}
        agents={agents}
        onMoveNode={(nodeId, x, y) => moveNode(flow.id, nodeId, x, y)}
        onConnect={(sourceId, targetId) => connectNodes(flow.id, sourceId, targetId)}
        onRemoveConnection={(sourceId) => removeConnection(flow.id, sourceId)}
        onNodeLongPress={(nodeId) => setActionSheetNodeId(nodeId)}
        onViewportChange={(info) => {
          viewportRef.current = info;
        }}
      />

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
    flowNameWrap: { flex: 1, marginHorizontal: spacing.sm },
    flowName: { color: colors.textPrimary, fontSize: 16, fontWeight: "700" },
    agentCount: { color: colors.textSecondary, fontSize: 11, marginTop: 1 },
    runButton: { borderWidth: 1, borderColor: colors.accent, paddingVertical: 6, paddingHorizontal: spacing.sm },
    runButtonPressed: { backgroundColor: colors.accent + "22" },
    runButtonDisabled: { borderColor: colors.border },
    runButtonLabel: { color: colors.accent, fontSize: 12, fontWeight: "700" },
    runButtonLabelDisabled: { color: colors.textSecondary },
    // Bumped up from a subdued single-line strip of small monospace text to
    // a proper labeled field — a flow with no model picked can never run,
    // so this deserves the same visual weight as a required setting, not a
    // secondary detail.
    modelChip: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      borderLeftWidth: 3,
      borderLeftColor: colors.accentTertiary,
      backgroundColor: colors.surface,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
    },
    modelChipWarning: { borderLeftColor: colors.error },
    modelChipEmpty: { borderLeftColor: colors.textSecondary },
    modelChipEyebrow: { color: colors.textSecondary, fontSize: 9, fontWeight: "700", letterSpacing: 0.5, marginRight: spacing.sm },
    modelChipLabel: { flex: 1, color: colors.textPrimary, fontSize: 13, fontWeight: "600", fontFamily: "monospace", marginRight: spacing.sm },
    modelChipLabelWarning: { color: colors.error },
    modelChipCaret: { color: colors.textSecondary, fontSize: 10 },
    settingsPanel: {
      backgroundColor: colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      padding: spacing.md,
    },
    settingsNote: { color: colors.textSecondary, fontSize: 11, marginBottom: spacing.sm },
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
