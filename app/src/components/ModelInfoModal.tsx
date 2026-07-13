import React, { useMemo } from "react";
import { Modal, Pressable, View, StyleSheet } from "react-native";
import { Text } from "./Text";
import { Button } from "./Button";
import { ColorPalette, spacing } from "../theme/colors";
import { useColors } from "../theme/ThemeContext";
import { LocalModel } from "../services/modelStorage";
import { formatBytes, formatDate } from "../utils/format";

interface ModelInfoModalProps {
  visible: boolean;
  model: LocalModel | null;
  onClose: () => void;
  onDelete: () => void;
  onExport: () => void;
  exporting?: boolean;
}

/** What we actually have for a locally-stored model — filename, quant,
 * size, when it was added, and its on-device path. There's no README/repo
 * description here because downloaded models aren't linked back to their
 * source Hugging Face repo once saved — showing one would mean faking it. */
export function ModelInfoModal({ visible, model, onClose, onDelete, onExport, exporting }: ModelInfoModalProps) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  if (!model) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.card} onPress={() => {}}>
          <Text style={styles.title} numberOfLines={2}>
            {model.filename}
          </Text>
          <View style={styles.row}>
            <Text style={styles.label}>Quantization</Text>
            <Text style={styles.value}>{model.quant ?? "Unknown"}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Size</Text>
            <Text style={styles.value}>{formatBytes(model.sizeBytes)}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Added</Text>
            <Text style={styles.value}>{formatDate(model.addedAt)}</Text>
          </View>
          <Text style={styles.pathLabel}>Path</Text>
          <Text style={styles.path}>{model.path}</Text>
          <Text style={styles.note}>
            No description or README is available — downloaded models aren't linked back to their source Hugging
            Face repo once saved on-device.
          </Text>
          <Button label="Export to device" onPress={onExport} variant="secondary" loading={exporting} />
          <View style={styles.buttonRow}>
            <View style={styles.buttonHalf}>
              <Button label="Close" onPress={onClose} variant="neutral" />
            </View>
            <View style={styles.buttonHalf}>
              <Button label="Delete" onPress={onDelete} variant="danger" />
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
      borderTopColor: colors.accentTertiary,
      padding: spacing.lg,
      gap: spacing.sm,
    },
    title: { color: colors.textPrimary, fontSize: 15, fontWeight: "700", fontFamily: "monospace", marginBottom: spacing.xs },
    row: { flexDirection: "row", justifyContent: "space-between" },
    label: { color: colors.textSecondary, fontSize: 13 },
    value: { color: colors.textPrimary, fontSize: 13, fontWeight: "600" },
    pathLabel: { color: colors.textSecondary, fontSize: 13, marginTop: spacing.xs },
    path: { color: colors.textSecondary, fontSize: 11, fontFamily: "monospace" },
    note: { color: colors.textSecondary, fontSize: 11, textAlign: "justify", marginTop: spacing.xs, marginBottom: spacing.sm },
    buttonRow: { flexDirection: "row", gap: spacing.sm },
    buttonHalf: { flex: 1 },
  });
}
