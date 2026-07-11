import React, { useMemo } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text } from "react-native";
import { ColorPalette, spacing } from "../theme/colors";
import { useColors } from "../theme/ThemeContext";

export interface PickerOption {
  label: string;
  value: string;
}

interface PickerModalProps {
  visible: boolean;
  title: string;
  options: PickerOption[];
  selectedValue?: string | null;
  onSelect: (value: string) => void;
  onClose: () => void;
  emptyLabel?: string;
}

export function PickerModal({ visible, title, options, selectedValue, onSelect, onClose, emptyLabel }: PickerModalProps) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.card} onPress={() => {}}>
          <Text style={styles.title}>{title}</Text>
          <ScrollView style={styles.list} bounces={false}>
            {options.length === 0 ? (
              <Text style={styles.empty}>{emptyLabel ?? "Nothing available."}</Text>
            ) : (
              options.map((opt) => {
                const active = opt.value === selectedValue;
                return (
                  <Pressable
                    key={opt.value}
                    onPress={() => {
                      onSelect(opt.value);
                      onClose();
                    }}
                    style={({ pressed }) => [styles.option, active && styles.optionActive, pressed && styles.optionPressed]}
                  >
                    <Text style={[styles.optionLabel, active && styles.optionLabelActive]} numberOfLines={1}>
                      {opt.label}
                    </Text>
                    {active ? <Text style={styles.check}>✓</Text> : null}
                  </Pressable>
                );
              })
            )}
          </ScrollView>
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
      maxHeight: "70%",
    },
    title: { color: colors.textPrimary, fontSize: 16, fontWeight: "700", padding: spacing.md, paddingBottom: spacing.sm },
    list: { paddingHorizontal: spacing.sm, paddingBottom: spacing.sm },
    empty: { color: colors.textSecondary, fontSize: 13, padding: spacing.md, textAlign: "center" },
    option: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    optionActive: { backgroundColor: colors.accent + "18" },
    optionPressed: { backgroundColor: colors.surfaceAlt },
    optionLabel: { color: colors.textPrimary, fontSize: 14, flexShrink: 1, marginRight: spacing.sm },
    optionLabelActive: { color: colors.accent, fontWeight: "600" },
    check: { color: colors.accent, fontSize: 14, fontWeight: "700" },
  });
}
