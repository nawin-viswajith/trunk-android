import React, { useMemo } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { Button } from "./Button";
import { ColorPalette, spacing } from "../theme/colors";
import { useColors } from "../theme/ThemeContext";

interface ConfirmModalProps {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/** App-styled replacement for Alert.alert() confirmations -- the native
 * Android dialog looks out of place against the rest of the flat, sharp-edged
 * design, so every "are you sure?" prompt (delete project, bulk delete, etc.)
 * should route through this instead. */
export function ConfirmModal({
  visible,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  destructive,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable style={styles.backdrop} onPress={onCancel}>
        <Pressable style={[styles.card, destructive && styles.cardDestructive]} onPress={() => {}}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>
          <View style={styles.buttonRow}>
            <View style={styles.buttonHalf}>
              <Button label={cancelLabel} onPress={onCancel} variant="neutral" />
            </View>
            <View style={styles.buttonHalf}>
              <Button label={confirmLabel} onPress={onConfirm} variant={destructive ? "danger" : "primary"} />
            </View>
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
    },
    cardDestructive: { borderTopColor: colors.error },
    title: { color: colors.textPrimary, fontSize: 17, fontWeight: "700", marginBottom: spacing.sm },
    message: { color: colors.textSecondary, fontSize: 14, lineHeight: 20, marginBottom: spacing.lg, textAlign: "justify" },
    buttonRow: { flexDirection: "row", gap: spacing.sm },
    buttonHalf: { flex: 1 },
  });
}
