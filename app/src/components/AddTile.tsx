import React, { useMemo } from "react";
import { Pressable, StyleSheet } from "react-native";
import { Text } from "./Text";
import { ColorPalette, spacing } from "../theme/colors";
import { useColors } from "../theme/ThemeContext";

interface AddTileProps {
  label: string;
  onPress: () => void;
}

/** The one place a screen's primary "+" action lives — a full-width bordered
 * row sitting right under the header, always visible (not a FAB a thumb
 * covers, not a small icon buried among header buttons). Reads like every
 * other bordered row in the app instead of introducing a new shape. */
export function AddTile({ label, onPress }: AddTileProps) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.tile, pressed && styles.tilePressed]}>
      <Text style={styles.plus}>+</Text>
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  );
}

function createStyles(colors: ColorPalette) {
  return StyleSheet.create({
    tile: {
      flexDirection: "row",
      alignItems: "center",
      borderWidth: 1,
      borderColor: colors.border,
      borderLeftWidth: 3,
      borderLeftColor: colors.accent,
      backgroundColor: colors.surface,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      marginHorizontal: spacing.md,
      marginBottom: spacing.sm,
      gap: spacing.sm,
    },
    tilePressed: { backgroundColor: colors.surfaceAlt },
    plus: { color: colors.accent, fontSize: 18, fontWeight: "700", lineHeight: 20 },
    label: { color: colors.accent, fontSize: 14, fontWeight: "600" },
  });
}
