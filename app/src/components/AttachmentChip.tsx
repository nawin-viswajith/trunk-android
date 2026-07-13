import React, { useMemo } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Text } from "./Text";
import { ColorPalette, spacing } from "../theme/colors";
import { useColors } from "../theme/ThemeContext";

interface AttachmentChipProps {
  name: string;
  truncated?: boolean;
  onRemove: () => void;
}

export function AttachmentChip({ name, truncated, onRemove }: AttachmentChipProps) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <View style={styles.chip}>
      <Text style={styles.name} numberOfLines={1}>
        FILE · {name}
        {truncated ? " (truncated)" : ""}
      </Text>
      <Pressable onPress={onRemove} hitSlop={8}>
        <Text style={styles.remove}>×</Text>
      </Pressable>
    </View>
  );
}

function createStyles(colors: ColorPalette) {
  return StyleSheet.create({
    chip: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      borderWidth: 1,
      borderColor: colors.border,
      borderLeftWidth: 3,
      borderLeftColor: colors.accentTertiary,
      backgroundColor: colors.surfaceAlt,
      paddingVertical: spacing.xs,
      paddingHorizontal: spacing.sm,
      marginBottom: spacing.xs,
    },
    name: { color: colors.textPrimary, fontSize: 11, fontWeight: "600", flexShrink: 1, marginRight: spacing.sm, fontFamily: "monospace" },
    remove: { color: colors.textSecondary, fontSize: 16, fontWeight: "700" },
  });
}
