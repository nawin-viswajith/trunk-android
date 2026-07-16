import React, { useEffect, useMemo, useState } from "react";
import { Modal, Pressable, StyleSheet, View } from "react-native";
import { Text } from "./Text";
import { Button } from "./Button";
import { ColorPalette, spacing } from "../theme/colors";
import { useColors } from "../theme/ThemeContext";

export interface GuideStep {
  title: string;
  description: string;
}

interface PageGuideModalProps {
  visible: boolean;
  onClose: () => void;
  steps: GuideStep[];
}

/** Per-page walkthrough: one step at a time with Prev/Next, plus an
 * explicit Close - distinct from HelpModal's single all-sections-at-once
 * summary, which stays Home-only. */
export function PageGuideModal({ visible, onClose, steps }: PageGuideModalProps) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (visible) setIndex(0);
  }, [visible]);

  const step = steps[index];
  const isFirst = index === 0;
  const isLast = index === steps.length - 1;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.card} onPress={() => {}}>
          <View style={styles.header}>
            <Text style={styles.counter}>
              {index + 1} / {steps.length}
            </Text>
            <Pressable onPress={onClose} hitSlop={12}>
              <Text style={styles.closeGlyph}>{`\u2715`}</Text>
            </Pressable>
          </View>

          <Text style={styles.title}>{step.title}</Text>
          <Text style={styles.description}>{step.description}</Text>

          <View style={styles.buttonRow}>
            <View style={styles.buttonHalf}>
              <Button label="Prev" onPress={() => setIndex((i) => i - 1)} variant="neutral" disabled={isFirst} />
            </View>
            <View style={styles.buttonHalf}>
              <Button
                label={isLast ? "Done" : "Next"}
                onPress={() => (isLast ? onClose() : setIndex((i) => i + 1))}
                variant="secondary"
              />
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
      gap: spacing.sm,
    },
    header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    counter: { color: colors.textSecondary, fontSize: 12, fontFamily: "monospace" },
    closeGlyph: { color: colors.textSecondary, fontSize: 16, fontWeight: "700" },
    title: { color: colors.textPrimary, fontSize: 18, fontWeight: "700", marginTop: spacing.xs },
    description: { color: colors.textSecondary, fontSize: 14, lineHeight: 20 },
    buttonRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.md },
    buttonHalf: { flex: 1 },
  });
}
