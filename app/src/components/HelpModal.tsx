import React, { useMemo } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Text } from "./Text";
import { Button } from "./Button";
import { ColorPalette, spacing } from "../theme/colors";
import { useColors } from "../theme/ThemeContext";
import { PERFORMANCE_DISCLAIMER } from "../copy/disclaimers";

const SECTIONS = [
  { label: "Home", description: "your device's RAM and a suggested max model size." },
  { label: "Models", description: "browse and download GGUF models from Hugging Face, or import one you already have." },
  { label: "Projects", description: "bind a downloaded model to a set of generation settings (temperature, context length, etc)." },
  { label: "Playground", description: "wire reusable Agents (saved personas) into a linear Flow, and run the chain on demand - fully on-device, sharing whichever model is currently loaded." },
  { label: "Inference", description: "chat with a project's model, fully on-device." },
];

export function HelpModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.card} onPress={() => {}}>
          <ScrollView showsVerticalScrollIndicator={false}>
            <Text style={styles.title}>How Trunk works</Text>
            {SECTIONS.map((s) => (
              <View key={s.label} style={styles.row}>
                <Text style={styles.label}>{s.label}</Text>
                <Text style={styles.description}>{"\u2022 "}{s.description}</Text>
              </View>
            ))}
            <View style={styles.divider} />
            <Text style={styles.warningTitle}>{`\u26A0 `}{PERFORMANCE_DISCLAIMER.title}</Text>
            <Text style={styles.description}>{PERFORMANCE_DISCLAIMER.body}</Text>
            <Text style={styles.warningEmphasis}>{PERFORMANCE_DISCLAIMER.emphasis}</Text>
          </ScrollView>
          <View style={styles.buttonRow}>
            <Button label="Got it" onPress={onClose} variant="secondary" />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function createStyles(colors: ColorPalette) {
  return StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.6)",
      justifyContent: "center",
      padding: spacing.lg,
    },
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
    row: { gap: 2, marginBottom: spacing.md },
    label: { color: colors.accent, fontSize: 13, fontWeight: "700" },
    description: { color: colors.textSecondary, fontSize: 13, lineHeight: 19 },
    divider: { height: 1, backgroundColor: colors.border, marginBottom: spacing.md },
    warningTitle: { color: colors.error, fontSize: 14, fontWeight: "700", marginBottom: spacing.xs },
    warningEmphasis: { color: colors.error, fontSize: 13, fontWeight: "700", lineHeight: 19, marginTop: spacing.xs },
    buttonRow: { marginTop: spacing.md },
  });
}
