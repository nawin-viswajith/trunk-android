import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { colors, spacing } from "../theme/colors";
import { ModelInfo } from "../api/types";
import { Button } from "./Button";
import { StatusBadge } from "./StatusBadge";

function formatSize(bytes: number): string {
  const gb = bytes / 1024 ** 3;
  return gb >= 1 ? `${gb.toFixed(1)} GB` : `${(bytes / 1024 ** 2).toFixed(0)} MB`;
}

interface ModelCardProps {
  model: ModelInfo;
  onPush: () => void;
  onDelete: () => void;
}

export function ModelCard({ model, onPush, onDelete }: ModelCardProps) {
  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.name}>{model.filename}</Text>
        <StatusBadge
          status={model.installed_on_device ? "pass" : "skipped"}
          label={model.installed_on_device ? "ON DEVICE" : "LOCAL ONLY"}
        />
      </View>
      <Text style={styles.meta}>
        {[model.quant, formatSize(model.size_bytes), model.architecture, model.context_length ? `${model.context_length} ctx` : null]
          .filter(Boolean)
          .join(" · ")}
      </Text>
      <View style={styles.actions}>
        <Button label="Push to Device" onPress={onPush} variant="secondary" />
        <Button label="Delete" onPress={onDelete} variant="danger" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
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
