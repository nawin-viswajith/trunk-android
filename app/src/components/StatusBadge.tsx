import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useColors } from "../theme/ThemeContext";

export function StatusBadge({ status, label }: { status: string; label?: string }) {
  const colors = useColors();
  const STATUS_COLOR: Record<string, string> = {
    pass: colors.running,
    running: colors.running,
    supported: colors.running,
    fail: colors.error,
    error: colors.error,
    not_supported: colors.error,
    warn: colors.warning,
    warning: colors.warning,
    can_bottleneck: colors.warning,
    skipped: colors.textSecondary,
    unknown: colors.textSecondary,
  };
  const color = STATUS_COLOR[status] ?? colors.textSecondary;
  return (
    <View style={[styles.badge, { borderColor: color }]}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text style={[styles.text, { color }]}>{label ?? status.toUpperCase()}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
    alignSelf: "flex-start",
  },
  dot: {
    width: 6,
    height: 6,
    marginRight: 6,
  },
  text: {
    fontSize: 12,
    fontFamily: "monospace",
    letterSpacing: 0.5,
  },
});
