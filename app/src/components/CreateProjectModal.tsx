import React, { useMemo, useState } from "react";
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Text } from "./Text";
import { TextInput } from "./TextInput";
import { Button } from "./Button";
import { CheckIndicator } from "./CheckIndicator";
import { ColorPalette, spacing } from "../theme/colors";
import { useColors } from "../theme/ThemeContext";
import { LocalModel } from "../services/modelStorage";
import { parseInferenceParams, INFERENCE_PARAM_HINT } from "../utils/inferenceParams";

export interface NewProjectParams {
  name: string;
  modelFilename: string | null;
  temperature: number;
  topP: number;
  topK: number;
  contextLength: number;
  maxTokens: number;
}

interface CreateProjectModalProps {
  visible: boolean;
  onClose: () => void;
  models: LocalModel[];
  onCreate: (params: NewProjectParams) => void;
}

const DEFAULTS = { temperature: "0.7", topP: "0.9", topK: "40", contextLength: "2048", maxTokens: "512" };

export function CreateProjectModal({ visible, onClose, models, onCreate }: CreateProjectModalProps) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [name, setName] = useState("");
  const [modelFilename, setModelFilename] = useState<string | null>(null);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [temperature, setTemperature] = useState(DEFAULTS.temperature);
  const [topP, setTopP] = useState(DEFAULTS.topP);
  const [topK, setTopK] = useState(DEFAULTS.topK);
  const [contextLength, setContextLength] = useState(DEFAULTS.contextLength);
  const [maxTokens, setMaxTokens] = useState(DEFAULTS.maxTokens);
  const [paramError, setParamError] = useState<string | null>(null);

  const reset = () => {
    setName("");
    setModelFilename(null);
    setAdvancedOpen(false);
    setTemperature(DEFAULTS.temperature);
    setTopP(DEFAULTS.topP);
    setTopK(DEFAULTS.topK);
    setContextLength(DEFAULTS.contextLength);
    setMaxTokens(DEFAULTS.maxTokens);
    setParamError(null);
  };

  const close = () => {
    reset();
    onClose();
  };

  const create = () => {
    if (!name.trim()) return;
    const parsed = parseInferenceParams({ temperature, topP, topK, contextLength, maxTokens });
    if (!parsed) {
      setParamError(INFERENCE_PARAM_HINT);
      return;
    }
    onCreate({ name: name.trim(), modelFilename, ...parsed });
    close();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
      {/* Without this, a plain centered Modal doesn't reposition for the
       * keyboard on Android — the Context/Max tokens fields further down
       * the form were getting hidden behind it with no way to reach them. */}
      <KeyboardAvoidingView style={styles.backdrop} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <Pressable style={styles.backdropTouchable} onPress={close}>
          <Pressable style={styles.card} onPress={() => {}}>
            <ScrollView bounces={false}>
            <Text style={styles.title}>New Project</Text>

            <Text style={styles.label}>Name</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="My project"
              placeholderTextColor={colors.textSecondary}
              style={styles.input}
              autoFocus
            />

            <Text style={styles.label}>Model (optional)</Text>
            <View style={styles.modelList}>
              <Pressable
                onPress={() => {
                  setModelFilename(null);
                  setAdvancedOpen(false);
                }}
                style={[styles.modelOption, modelFilename === null && styles.modelOptionActive]}
              >
                <Text style={[styles.modelOptionLabel, modelFilename === null && styles.modelOptionLabelActive]}>
                  None — assign later
                </Text>
                <CheckIndicator checked={modelFilename === null} />
              </Pressable>
              {models.map((m) => {
                const active = modelFilename === m.filename;
                return (
                  <Pressable
                    key={m.filename}
                    onPress={() => setModelFilename(m.filename)}
                    style={[styles.modelOption, active && styles.modelOptionActive]}
                  >
                    <Text style={[styles.modelOptionLabel, active && styles.modelOptionLabelActive]} numberOfLines={1}>
                      {m.filename}
                    </Text>
                    <CheckIndicator checked={active} />
                  </Pressable>
                );
              })}
              {models.length === 0 ? (
                <Text style={styles.hint}>No models downloaded yet — you can assign one later.</Text>
              ) : null}
            </View>

            {modelFilename ? (
              <>
                <Pressable onPress={() => setAdvancedOpen((v) => !v)} style={styles.advancedToggle}>
                  <Text style={styles.advancedToggleArrow}>{advancedOpen ? "▾" : "▸"}</Text>
                  <Text style={styles.advancedToggleLabel}>Generation settings (optional)</Text>
                </Pressable>
                {advancedOpen ? (
                  <View style={styles.paramGroup}>
                    <View style={styles.paramRow}>
                      <Text style={styles.paramLabel}>Temperature</Text>
                      <TextInput value={temperature} onChangeText={setTemperature} keyboardType="decimal-pad" style={styles.paramInput} />
                    </View>
                    <View style={styles.paramRow}>
                      <Text style={styles.paramLabel}>Top P</Text>
                      <TextInput value={topP} onChangeText={setTopP} keyboardType="decimal-pad" style={styles.paramInput} />
                    </View>
                    <View style={styles.paramRow}>
                      <Text style={styles.paramLabel}>Top K</Text>
                      <TextInput value={topK} onChangeText={setTopK} keyboardType="number-pad" style={styles.paramInput} />
                    </View>
                    <View style={styles.paramRow}>
                      <Text style={styles.paramLabel}>Context</Text>
                      <TextInput value={contextLength} onChangeText={setContextLength} keyboardType="number-pad" style={styles.paramInput} />
                    </View>
                    <View style={styles.paramRow}>
                      <Text style={styles.paramLabel}>Max tokens</Text>
                      <TextInput value={maxTokens} onChangeText={setMaxTokens} keyboardType="number-pad" style={styles.paramInput} />
                    </View>
                    {paramError ? <Text style={styles.error}>{paramError}</Text> : null}
                  </View>
                ) : null}
              </>
            ) : null}

            <View style={styles.buttonRow}>
              <View style={styles.buttonHalf}>
                <Button label="Cancel" onPress={close} variant="neutral" />
              </View>
              <View style={styles.buttonHalf}>
                <Button label="Create" onPress={create} variant="secondary" disabled={!name.trim()} />
              </View>
            </View>
            </ScrollView>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function createStyles(colors: ColorPalette) {
  return StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.6)",
    },
    backdropTouchable: {
      flex: 1,
      justifyContent: "center",
      padding: spacing.lg,
    },
    card: {
      maxHeight: "85%",
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderTopWidth: 3,
      borderTopColor: colors.accent,
      padding: spacing.lg,
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
    modelList: { gap: spacing.xs, maxHeight: 220 },
    modelOption: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.sm,
    },
    modelOptionActive: { borderColor: colors.accent, backgroundColor: colors.accent + "22" },
    modelOptionLabel: { color: colors.textSecondary, fontSize: 12, fontFamily: "monospace", flexShrink: 1, marginRight: spacing.sm },
    modelOptionLabelActive: { color: colors.accent, fontWeight: "600" },
    hint: { color: colors.textSecondary, fontSize: 12 },
    advancedToggle: { flexDirection: "row", alignItems: "center", gap: spacing.xs, marginTop: spacing.md },
    advancedToggleArrow: { color: colors.accentSecondary, fontSize: 20, fontWeight: "700" },
    advancedToggleLabel: { color: colors.accentSecondary, fontSize: 13, fontWeight: "600" },
    paramGroup: { marginTop: spacing.sm, gap: spacing.sm },
    paramRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
    paramLabel: { color: colors.textSecondary, fontSize: 12, width: 80 },
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
    buttonRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.lg },
    buttonHalf: { flex: 1 },
    error: { color: colors.error, fontSize: 12, marginTop: spacing.xs },
  });
}
