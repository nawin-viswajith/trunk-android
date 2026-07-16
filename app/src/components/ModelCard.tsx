import React, { useMemo } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Text } from "./Text";
import { CheckIndicator } from "./CheckIndicator";
import { spacing, ColorPalette } from "../theme/colors";
import { useColors } from "../theme/ThemeContext";
import { LocalModel } from "../services/modelStorage";
import { formatBytes, formatDate } from "../utils/format";

interface ModelCardProps {
  model: LocalModel;
  onPress: () => void;
  onLongPress?: () => void;
  onToggleSelect?: () => void;
  selectionMode?: boolean;
  selected?: boolean;
  /** 0-1 fraction - while set, this row shows live download progress instead
   * of its normal size/date metadata, and can't be opened or selected: the
   * file on disk is still partial. */
  downloadProgress?: number;
}

export function ModelCard({
  model,
  onPress,
  onLongPress,
  onToggleSelect,
  selectionMode,
  selected,
  downloadProgress,
}: ModelCardProps) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const downloading = downloadProgress !== undefined;
  return (
    <Pressable
      onPress={downloading ? undefined : selectionMode ? onToggleSelect : onPress}
      onLongPress={downloading ? undefined : onLongPress}
      style={({ pressed }) => [styles.card, selected && styles.cardSelected, pressed && !downloading && styles.cardPressed]}
    >
      <View style={styles.textWrap}>
        <Text style={styles.name} numberOfLines={1}>
          {model.filename}
        </Text>
        {downloading ? (
          <Text style={styles.downloadingMeta}>{`Downloading\u2026 `}{(downloadProgress * 100).toFixed(0)}%</Text>
        ) : (
          <Text style={styles.meta}>
            {[model.quant, formatBytes(model.sizeBytes), formatDate(model.addedAt)].filter(Boolean).join(" \u00B7 ")}
          </Text>
        )}
      </View>
      {!downloading && selectionMode ? <CheckIndicator checked={!!selected} /> : null}
    </Pressable>
  );
}

function createStyles(colors: ColorPalette) {
  return StyleSheet.create({
    card: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      borderWidth: 1,
      borderColor: colors.border,
      borderLeftWidth: 3,
      borderLeftColor: colors.accentTertiary,
      backgroundColor: colors.surface,
      padding: spacing.md,
      marginBottom: spacing.sm,
    },
    cardSelected: { borderColor: colors.accent, backgroundColor: colors.accent + "18" },
    cardPressed: { backgroundColor: colors.surfaceAlt },
    textWrap: { flex: 1, marginRight: spacing.sm },
    name: {
      color: colors.textPrimary,
      fontWeight: "600",
      fontSize: 14,
      fontFamily: "monospace",
      marginBottom: spacing.xs,
    },
    meta: {
      color: colors.textSecondary,
      fontSize: 12,
      fontFamily: "monospace",
    },
    downloadingMeta: {
      color: colors.running,
      fontSize: 12,
      fontFamily: "monospace",
      fontWeight: "600",
    },
    trashButton: { padding: spacing.xs },
    trashButtonPressed: { opacity: 0.6 },
  });
}
