import React, { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { spacing, ColorPalette } from "../theme/colors";
import { useColors } from "../theme/ThemeContext";
import { Project } from "../api/types";
import { StatusBadge } from "./StatusBadge";

export function ProjectCard({ project, onPress }: { project: Project; onPress: () => void }) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const backendColor = project.backend === "hexagon" ? colors.npu : colors.cpu;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      <View style={styles.headerRow}>
        <Text style={styles.name}>{project.name}</Text>
        <View style={[styles.backendTag, { borderColor: backendColor }]}>
          <Text style={[styles.backendText, { color: backendColor }]}>{project.backend.toUpperCase()}</Text>
        </View>
      </View>
      <Text style={styles.meta}>{project.model_filename ?? "No model assigned"}</Text>
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
    headerRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: spacing.xs,
    },
    name: {
      color: colors.textPrimary,
      fontWeight: "600",
      fontSize: 15,
    },
    backendTag: {
      borderWidth: 1,
      paddingHorizontal: 6,
      paddingVertical: 2,
    },
    backendText: {
      fontSize: 11,
      fontFamily: "monospace",
    },
    meta: {
      color: colors.textSecondary,
      fontSize: 12,
    },
  });
}
