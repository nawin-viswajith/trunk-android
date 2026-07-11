import React, { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { spacing, ColorPalette } from "../theme/colors";
import { useColors } from "../theme/ThemeContext";
import { CheckResult } from "../api/types";
import { StatusBadge } from "./StatusBadge";

export function DoctorCheckRow({ check }: { check: CheckResult }) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <View style={styles.row}>
      <View style={styles.header}>
        <Text style={styles.label}>{check.label}</Text>
        <StatusBadge status={check.status} />
      </View>
      <Text style={styles.detail}>{check.detail}</Text>
      {check.fix_hint ? <Text style={styles.fixHint}>{check.fix_hint}</Text> : null}
    </View>
  );
}

function createStyles(colors: ColorPalette) {
  return StyleSheet.create({
    row: {
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surfaceAlt,
      padding: spacing.md,
      marginBottom: spacing.sm,
    },
    header: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: spacing.xs,
    },
    label: {
      color: colors.textPrimary,
      fontWeight: "600",
      fontSize: 14,
      flexShrink: 1,
      marginRight: spacing.sm,
    },
    detail: {
      color: colors.textSecondary,
      fontFamily: "monospace",
      fontSize: 12,
    },
    fixHint: {
      color: colors.warning,
      fontSize: 12,
      marginTop: spacing.xs,
    },
  });
}
