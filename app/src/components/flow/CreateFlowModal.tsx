import React, { useMemo, useState } from "react";
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, View } from "react-native";
import { Text } from "../Text";
import { TextInput } from "../TextInput";
import { Button } from "../Button";
import { ColorPalette, spacing } from "../../theme/colors";
import { useColors } from "../../theme/ThemeContext";

interface CreateFlowModalProps {
  visible: boolean;
  onClose: () => void;
  onCreate: (name: string) => void;
}

export function CreateFlowModal({ visible, onClose, onCreate }: CreateFlowModalProps) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [name, setName] = useState("");

  const close = () => {
    setName("");
    onClose();
  };

  const create = () => {
    if (!name.trim()) return;
    onCreate(name.trim());
    close();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
      <KeyboardAvoidingView style={styles.backdrop} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <Pressable style={styles.backdropTouchable} onPress={close}>
          <Pressable style={styles.card} onPress={() => {}}>
            <Text style={styles.title}>New Flow</Text>
            <Text style={styles.label}>Name</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="My flow"
              placeholderTextColor={colors.textSecondary}
              style={styles.input}
              autoFocus
            />
            <View style={styles.buttonRow}>
              <View style={styles.buttonHalf}>
                <Button label="Cancel" onPress={close} variant="neutral" />
              </View>
              <View style={styles.buttonHalf}>
                <Button label="Create" onPress={create} variant="secondary" disabled={!name.trim()} />
              </View>
            </View>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function createStyles(colors: ColorPalette) {
  return StyleSheet.create({
    backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)" },
    backdropTouchable: { flex: 1, justifyContent: "center", padding: spacing.lg },
    card: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderTopWidth: 3,
      borderTopColor: colors.accent,
      padding: spacing.lg,
    },
    title: { color: colors.textPrimary, fontSize: 18, fontWeight: "700", marginBottom: spacing.md },
    label: { color: colors.textSecondary, fontSize: 12, marginBottom: spacing.xs },
    input: {
      borderWidth: 1,
      borderColor: colors.border,
      color: colors.textPrimary,
      backgroundColor: colors.surfaceAlt,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.sm,
    },
    buttonRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.lg },
    buttonHalf: { flex: 1 },
  });
}
