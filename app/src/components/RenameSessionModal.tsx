import React, { useEffect, useMemo, useState } from "react";
import { Modal, Pressable, StyleSheet, View } from "react-native";
import { Text } from "./Text";
import { TextInput } from "./TextInput";
import { Button } from "./Button";
import { ColorPalette, spacing } from "../theme/colors";
import { useColors } from "../theme/ThemeContext";

interface RenameSessionModalProps {
  visible: boolean;
  initialName: string;
  onClose: () => void;
  onRename: (name: string) => void;
}

export function RenameSessionModal({ visible, initialName, onClose, onRename }: RenameSessionModalProps) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [name, setName] = useState(initialName);

  useEffect(() => {
    if (visible) setName(initialName);
  }, [visible, initialName]);

  const save = () => {
    if (!name.trim()) return;
    onRename(name.trim());
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.card} onPress={() => {}}>
          <Text style={styles.title}>Rename chat</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Chat name"
            placeholderTextColor={colors.textSecondary}
            style={styles.input}
            autoFocus
            selectTextOnFocus
          />
          <View style={styles.buttonRow}>
            <View style={styles.buttonHalf}>
              <Button label="Cancel" onPress={onClose} variant="neutral" />
            </View>
            <View style={styles.buttonHalf}>
              <Button label="Save" onPress={save} variant="secondary" disabled={!name.trim()} />
            </View>
          </View>
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
    },
    title: { color: colors.textPrimary, fontSize: 18, fontWeight: "700", marginBottom: spacing.md },
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
