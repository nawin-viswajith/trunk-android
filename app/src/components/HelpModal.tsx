import React, { useMemo } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { Button } from "./Button";
import { ColorPalette, spacing } from "../theme/colors";
import { useColors } from "../theme/ThemeContext";

const SECTIONS = [
  { label: "Home", description: "your device's RAM and a suggested max model size." },
  { label: "Models", description: "browse and download GGUF models from Hugging Face, or import one you already have." },
  { label: "Projects", description: "bind a downloaded model to a set of generation settings (temperature, context length, etc)." },
  { label: "Inference", description: "chat with a project's model, fully on-device." },
];

export function HelpModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.card} onPress={() => {}}>
          <Text style={styles.title}>How PocketCoder works</Text>
          {SECTIONS.map((s) => (
            <View key={s.label} style={styles.row}>
              <Text style={styles.label}>{s.label}</Text>
              <Text style={styles.description}>{"• "}{s.description}</Text>
            </View>
          ))}
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
      gap: spacing.md,
    },
    title: { color: colors.textPrimary, fontSize: 18, fontWeight: "700" },
    row: { gap: 2 },
    label: { color: colors.accent, fontSize: 13, fontWeight: "700" },
    description: { color: colors.textSecondary, fontSize: 13, lineHeight: 19 },
    buttonRow: { marginTop: spacing.xs },
  });
}
