import React, { useMemo } from "react";
import { Pressable, StyleSheet, Text } from "react-native";
import { spacing, ColorPalette } from "../theme/colors";
import { useColors } from "../theme/ThemeContext";
import { Project } from "../state/useProjectStore";

export function ProjectCard({ project, onPress }: { project: Project; onPress: () => void }) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      <Text style={styles.name}>{project.name}</Text>
      <Text style={styles.meta}>{project.modelFilename ?? "No model assigned"}</Text>
    </Pressable>
  );
}

function createStyles(colors: ColorPalette) {
  return StyleSheet.create({
    card: {
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      padding: spacing.md,
      marginBottom: spacing.sm,
    },
    pressed: {
      backgroundColor: colors.surfaceAlt,
    },
    name: {
      color: colors.textPrimary,
      fontWeight: "600",
      fontSize: 15,
      marginBottom: spacing.xs,
    },
    meta: {
      color: colors.textSecondary,
      fontSize: 12,
      fontFamily: "monospace",
    },
  });
}
