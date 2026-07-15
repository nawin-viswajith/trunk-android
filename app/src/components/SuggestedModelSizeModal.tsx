import React, { useMemo } from "react";
import { Modal, Pressable, StyleSheet, View } from "react-native";
import { Text } from "./Text";
import { Button } from "./Button";
import { ColorPalette, spacing } from "../theme/colors";
import { useColors } from "../theme/ThemeContext";
import { SuggestedModelBudget } from "../utils/compatibility";

interface SuggestedModelSizeModalProps {
  visible: boolean;
  onClose: () => void;
  budget: SuggestedModelBudget | null;
}

export function SuggestedModelSizeModal({ visible, onClose, budget }: SuggestedModelSizeModalProps) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.card} onPress={() => {}}>
          <Text style={styles.title}>Suggested Model Size</Text>
          {budget ? (
            <>
              <Text style={styles.hint}>
                Based on {(budget.availableMb / 1024).toFixed(1)} GB usable of{" "}
                {(budget.totalMb / 1024).toFixed(1)} GB total RAM, reserving headroom for the OS and other apps, plus
                a fixed runtime overhead for the model itself.
              </Text>
              {budget.perQuant.map((q) => (
                <View key={q.quant} style={styles.row}>
                  <Text style={styles.quantLabel}>{q.quant}</Text>
                  <Text style={styles.quantValue}>up to ~{q.maxParamsBillion.toFixed(1)}B parameters</Text>
                </View>
              ))}
              <Text style={styles.note}>
                No hard cutoff — larger models may still run but can bottleneck or crash from out-of-memory. Actual
                memory use varies by model architecture, so treat these as estimates, not guarantees.
              </Text>
            </>
          ) : (
            <Text style={styles.hint}>Could not read device memory.</Text>
          )}
          <View style={styles.buttonRow}>
            <Button label="Close" onPress={onClose} variant="secondary" />
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
      gap: spacing.sm,
    },
    title: { color: colors.textPrimary, fontSize: 18, fontWeight: "700", marginBottom: spacing.xs },
    hint: { color: colors.textSecondary, fontSize: 12, lineHeight: 17 },
    row: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      borderWidth: 1,
      borderColor: colors.border,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
    },
    quantLabel: { color: colors.accent, fontSize: 13, fontWeight: "700", fontFamily: "monospace" },
    quantValue: { color: colors.textPrimary, fontSize: 13, fontWeight: "600" },
    note: { color: colors.textSecondary, fontSize: 11, lineHeight: 16 },
    buttonRow: { marginTop: spacing.sm },
  });
}
