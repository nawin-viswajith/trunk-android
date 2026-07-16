import React, { useMemo } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Text } from "./Text";
import { PencilIcon } from "./PencilIcon";
import { ColorPalette, spacing } from "../theme/colors";
import { useColors } from "../theme/ThemeContext";

export interface PickerOption {
  label: string;
  value: string;
  /** Set false to hide the edit affordance for this specific row even when
   * the picker as a whole has onEditOption wired (e.g. a "+ New Chat"
   * sentinel option has no underlying entity to rename). Defaults to true. */
  editable?: boolean;
}

interface PickerModalProps {
  visible: boolean;
  title: string;
  options: PickerOption[];
  selectedValue?: string | null;
  onSelect: (value: string) => void;
  onClose: () => void;
  emptyLabel?: string;
  /** Rendered as its own tappable line right under emptyLabel - for an
   * empty message that names another screen ("create one in the Projects
   * tab"), this makes that screen an actual link instead of just naming it
   * in unclickable text. Closes this modal before navigating. */
  emptyLinkLabel?: string;
  onEmptyLinkPress?: () => void;
  /** When provided, an edit-glyph button appears on each row (except
   * options with no matching editable entity, e.g. "+ New Chat") that opens
   * a rename flow directly. Only used by the Inference screen's Chat picker
   * today; Project/Flow pickers simply don't pass it. */
  onEditOption?: (value: string) => void;
  /** When provided, long-pressing a row calls this instead of onEditOption -
   * lets the caller offer a choice (e.g. Rename/Delete) rather than jumping
   * straight into a rename flow. Falls back to onEditOption if this isn't
   * given, so existing callers keep their old long-press-to-rename behavior. */
  onLongPressOption?: (value: string) => void;
}

export function PickerModal({
  visible,
  title,
  options,
  selectedValue,
  onSelect,
  onClose,
  emptyLabel,
  emptyLinkLabel,
  onEmptyLinkPress,
  onEditOption,
  onLongPressOption,
}: PickerModalProps) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.card} onPress={() => {}}>
          <Text style={styles.title}>{title}</Text>
          <ScrollView style={styles.list} bounces={false}>
            {options.length === 0 ? (
              <>
                <Text style={styles.empty}>{emptyLabel ?? "Nothing available."}</Text>
                {emptyLinkLabel && onEmptyLinkPress ? (
                  <Pressable
                    onPress={() => {
                      onClose();
                      onEmptyLinkPress();
                    }}
                    hitSlop={8}
                  >
                    <Text style={styles.emptyLink}>{emptyLinkLabel}</Text>
                  </Pressable>
                ) : null}
              </>
            ) : (
              options.map((opt) => {
                const active = opt.value === selectedValue;
                const canEdit = !!onEditOption && opt.editable !== false;
                return (
                  <Pressable
                    key={opt.value}
                    onPress={() => {
                      onSelect(opt.value);
                      onClose();
                    }}
                    onLongPress={canEdit ? () => (onLongPressOption ?? onEditOption)!(opt.value) : undefined}
                    style={({ pressed }) => [styles.option, active && styles.optionActive, pressed && styles.optionPressed]}
                  >
                    <Text style={[styles.optionLabel, active && styles.optionLabelActive]} numberOfLines={1}>
                      {opt.label}
                    </Text>
                    <View style={styles.optionRight}>
                      {active ? <Text style={styles.check}>{`\u2713`}</Text> : null}
                      {canEdit ? (
                        <Pressable
                          onPress={(e) => {
                            e.stopPropagation();
                            onEditOption!(opt.value);
                          }}
                          hitSlop={10}
                          style={styles.editButton}
                        >
                          <PencilIcon color={colors.textSecondary} size={14} />
                        </Pressable>
                      ) : null}
                    </View>
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
    empty: { color: colors.textSecondary, fontSize: 13, padding: spacing.md, paddingBottom: spacing.xs, textAlign: "center" },
    emptyLink: {
      color: colors.accent,
      fontSize: 13,
      fontWeight: "600",
      textAlign: "center",
      paddingBottom: spacing.md,
    },
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
    optionRight: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
    check: { color: colors.accent, fontSize: 14, fontWeight: "700" },
    editButton: { padding: spacing.xs },
  });
}
