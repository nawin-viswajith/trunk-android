import React, { useEffect, useMemo, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Text } from "../Text";
import { TextInput } from "../TextInput";
import { Button } from "../Button";
import { CheckIndicator } from "../CheckIndicator";
import { Agent } from "../../state/useFlowStore";
import { complete, ensureLoaded, getActiveModelPath } from "../../services/llamaEngine";
import { listLocalModels, LocalModel, modelPath } from "../../services/modelStorage";
import { ColorPalette, spacing } from "../../theme/colors";
import { useColors } from "../../theme/ThemeContext";

interface AgentEditorModalProps {
  visible: boolean;
  agent?: Agent;
  onClose: () => void;
  onSave: (name: string, systemPrompt: string) => void;
}

type Mode = "write" | "craft";

const CRAFT_CONTEXT_LENGTH = 2048;

/** "Craft with AI" always fills the systemPrompt field for review/edit —
 * it never saves the generated text directly, so a bad draft is just as
 * editable as a hand-written one before Save is pressed. */
export function AgentEditorModal({ visible, agent, onClose, onSave }: AgentEditorModalProps) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [mode, setMode] = useState<Mode>("write");
  const [name, setName] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [purpose, setPurpose] = useState("");
  const [crafting, setCrafting] = useState(false);
  const [craftError, setCraftError] = useState<string | null>(null);
  const [modelReady, setModelReady] = useState(false);
  const [models, setModels] = useState<LocalModel[]>([]);
  const [activeFilename, setActiveFilename] = useState<string | null>(null);
  const [loadingModel, setLoadingModel] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setMode("write");
    setName(agent?.name ?? "");
    setSystemPrompt(agent?.systemPrompt ?? "");
    setPurpose("");
    setCraftError(null);
    const activePath = getActiveModelPath();
    setModelReady(!!activePath);
    listLocalModels().then((list) => {
      setModels(list);
      setActiveFilename(activePath ? list.find((m) => modelPath(m.filename) === activePath)?.filename ?? null : null);
    });
  }, [visible, agent]);

  const loadModel = async (filename: string) => {
    setLoadingModel(filename);
    setModelReady(false);
    setCraftError(null);
    try {
      await ensureLoaded(modelPath(filename), { contextLength: CRAFT_CONTEXT_LENGTH });
      setModelReady(true);
      setActiveFilename(filename);
    } catch (err) {
      setCraftError(String(err));
    } finally {
      setLoadingModel(null);
    }
  };

  const craft = async () => {
    if (!purpose.trim()) return;
    setCrafting(true);
    setCraftError(null);
    try {
      const result = await complete(
        {
          messages: [
            {
              role: "system",
              content:
                "You write effective system prompts for AI agents using the COSTAR framework: Context (the agent's role and the general kind/domain of input it will be given), Objective (the task it must accomplish), Style (how it should write — structure, level of detail), Tone (its attitude, e.g. formal, friendly, concise), Audience (who its output is for), and Response format (the expected shape/length of its replies). Structure the system prompt with those six labeled sections, each filled in briefly and concretely for the given purpose. This agent will be reused across many different runs, each with different real input arriving separately at request time — the Context section must describe the GENERAL type of input to expect (e.g. \"a block of text to summarize\"), never invent, assume, or embed a specific example of that input, since a fabricated example in the system prompt can be mistaken for the actual data and override it. Output only the system prompt text itself — no preamble, no quotes, no explanation.",
            },
            { role: "user", content: `Write a system prompt for an AI agent whose purpose is: ${purpose.trim()}` },
          ],
          temperature: 0.7,
          topP: 0.9,
          topK: 40,
          maxTokens: 600,
        },
        () => {}
      );
      setSystemPrompt(result.text.trim());
      setMode("write");
    } catch (err) {
      setCraftError(String(err));
    } finally {
      setCrafting(false);
    }
  };

  const save = () => {
    if (!name.trim() || !systemPrompt.trim()) return;
    onSave(name.trim(), systemPrompt.trim());
  };

  const canSave = !!name.trim() && !!systemPrompt.trim();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.card} onPress={() => {}}>
          <ScrollView keyboardShouldPersistTaps="handled">
            <Text style={styles.title}>{agent ? "Edit Agent" : "New Agent"}</Text>

            <Text style={styles.label}>Name</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Brainstormer"
              placeholderTextColor={colors.textSecondary}
              style={styles.input}
            />

            <View style={styles.modeRow}>
              <Pressable
                onPress={() => setMode("write")}
                style={[styles.modeTab, mode === "write" && styles.modeTabActive]}
              >
                <Text style={[styles.modeTabLabel, mode === "write" && styles.modeTabLabelActive]}>Write it myself</Text>
              </Pressable>
              <Pressable
                onPress={() => setMode("craft")}
                style={[styles.modeTab, mode === "craft" && styles.modeTabActive]}
              >
                <Text style={[styles.modeTabLabel, mode === "craft" && styles.modeTabLabelActive]}>Craft with AI</Text>
              </Pressable>
            </View>

            {mode === "write" ? (
              <>
                <Text style={styles.label}>System prompt</Text>
                <TextInput
                  value={systemPrompt}
                  onChangeText={setSystemPrompt}
                  placeholder="You are an expert at generating creative ideas..."
                  placeholderTextColor={colors.textSecondary}
                  style={[styles.input, styles.textarea]}
                  multiline
                  textAlignVertical="top"
                />
              </>
            ) : (
              <>
                {/* The model list and the purpose field render together,
                 * not one gated behind the other — a cold model load is a
                 * real 5-20s wait, and there's no reason typing the purpose
                 * has to wait for it too. Only the actual Generate call
                 * needs the model to be ready. The list stays visible even
                 * once a model is loaded (rather than disappearing), so
                 * switching to a different downloaded model is always
                 * possible, matching the picker pattern used everywhere
                 * else in the app (Project Detail, Flow Editor). */}
                <Text style={styles.label}>Model to craft with</Text>
                {models.map((m) => {
                  const active = m.filename === activeFilename;
                  return (
                    <Pressable
                      key={m.filename}
                      style={[styles.modelOption, active && styles.modelOptionActive]}
                      onPress={() => loadModel(m.filename)}
                      disabled={!!loadingModel}
                    >
                      <Text style={[styles.modelOptionLabel, active && styles.modelOptionLabelActive]} numberOfLines={1}>
                        {m.filename}
                      </Text>
                      {loadingModel === m.filename ? (
                        <Text style={styles.modelOptionHint}>Loading...</Text>
                      ) : (
                        <CheckIndicator checked={active} />
                      )}
                    </Pressable>
                  );
                })}
                {models.length === 0 ? (
                  <Text style={styles.modelEmpty}>No models downloaded yet - get one from the Models tab.</Text>
                ) : null}
                {craftError ? <Text style={styles.error}>{craftError}</Text> : null}

                <Text style={styles.label}>Describe the agent's purpose</Text>
                <TextInput
                  value={purpose}
                  onChangeText={setPurpose}
                  placeholder="Brainstorms creative angles on a topic"
                  placeholderTextColor={colors.textSecondary}
                  style={[styles.input, styles.textareaSmall]}
                  multiline
                  textAlignVertical="top"
                />
                <Button
                  label={modelReady ? "Generate" : "Waiting for model..."}
                  onPress={craft}
                  variant="secondary"
                  loading={crafting}
                  disabled={!purpose.trim() || !modelReady}
                />
                {systemPrompt ? (
                  <>
                    <Text style={styles.label}>Draft (edit before saving)</Text>
                    <TextInput
                      value={systemPrompt}
                      onChangeText={setSystemPrompt}
                      style={[styles.input, styles.textarea]}
                      multiline
                      textAlignVertical="top"
                    />
                  </>
                ) : null}
              </>
            )}

            <View style={styles.buttonRow}>
              <View style={styles.buttonHalf}>
                <Button label="Cancel" onPress={onClose} variant="neutral" />
              </View>
              <View style={styles.buttonHalf}>
                <Button label="Save" onPress={save} variant="secondary" disabled={!canSave} />
              </View>
            </View>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function createStyles(colors: ColorPalette) {
  return StyleSheet.create({
    backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "center", padding: spacing.lg },
    card: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderTopWidth: 3,
      borderTopColor: colors.accent,
      padding: spacing.lg,
      maxHeight: "85%",
    },
    title: { color: colors.textPrimary, fontSize: 18, fontWeight: "700", marginBottom: spacing.md },
    label: { color: colors.textSecondary, fontSize: 12, marginBottom: spacing.xs, marginTop: spacing.sm },
    input: {
      borderWidth: 1,
      borderColor: colors.border,
      color: colors.textPrimary,
      backgroundColor: colors.surfaceAlt,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.sm,
    },
    textarea: { minHeight: 120 },
    textareaSmall: { minHeight: 70 },
    modeRow: { flexDirection: "row", marginTop: spacing.md, borderWidth: 1, borderColor: colors.border },
    modeTab: { flex: 1, paddingVertical: spacing.sm, alignItems: "center" },
    modeTabActive: { backgroundColor: colors.accent + "22" },
    modeTabLabel: { color: colors.textSecondary, fontSize: 13, fontWeight: "600" },
    modeTabLabelActive: { color: colors.accent },
    error: { color: colors.error, fontSize: 12, marginTop: spacing.xs },
    modelOption: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      borderWidth: 1,
      borderColor: colors.border,
      borderLeftWidth: 3,
      borderLeftColor: "transparent",
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.sm,
      marginBottom: spacing.xs,
    },
    modelOptionActive: { borderLeftColor: colors.accentTertiary, backgroundColor: colors.accent + "22" },
    modelOptionLabel: { color: colors.textPrimary, fontSize: 13, fontFamily: "monospace", flexShrink: 1, marginRight: spacing.sm },
    modelOptionLabelActive: { color: colors.accent, fontWeight: "600" },
    modelOptionHint: { color: colors.accent, fontSize: 11, fontWeight: "600" },
    modelEmpty: { color: colors.textSecondary, fontSize: 13 },
    buttonRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.lg },
    buttonHalf: { flex: 1 },
  });
}
