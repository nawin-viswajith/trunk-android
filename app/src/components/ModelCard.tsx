import React, { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { spacing, ColorPalette } from "../theme/colors";
import { useColors } from "../theme/ThemeContext";
import { LocalModel } from "../services/modelStorage";
import { formatBytes } from "../utils/format";
import { Button } from "./Button";

interface ModelCardProps {
  model: LocalModel;
  onDelete: () => void;
}

export function ModelCard({ model, onDelete }: ModelCardProps) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.name} numberOfLines={1}>
          {model.filename}
        </Text>
      </View>
      <Text style={styles.meta}>{[model.quant, formatBytes(model.sizeBytes)].filter(Boolean).join(" · ")}</Text>
      <View style={styles.actions}>
        <Button label="Delete" onPress={onDelete} variant="danger" />
      </View>
    </View>
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
    headerRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: spacing.xs,
    },
    name: {
      color: colors.textPrimary,
      fontWeight: "600",
      fontSize: 14,
      flexShrink: 1,
      marginRight: spacing.sm,
      fontFamily: "monospace",
    },
    meta: {
      color: colors.textSecondary,
      fontSize: 12,
      fontFamily: "monospace",
      marginBottom: spacing.sm,
    },
    actions: {
      flexDirection: "row",
      gap: spacing.sm,
    },
  });
}
