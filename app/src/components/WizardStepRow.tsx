import React, { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { spacing, ColorPalette } from "../theme/colors";
import { useColors } from "../theme/ThemeContext";
import { CheckStatus } from "../api/types";
import { Button } from "./Button";
import { StatusBadge } from "./StatusBadge";

interface WizardStepRowProps {
  index: number;
  title: string;
  status: CheckStatus | "pending";
  running: boolean;
  onRun: () => void;
}

export function WizardStepRow({ index, title, status, running, onRun }: WizardStepRowProps) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <View style={styles.row}>
      <View style={styles.left}>
        <Text style={styles.index}>{index}</Text>
        <Text style={styles.title}>{title}</Text>
      </View>
      <View style={styles.right}>
        <StatusBadge status={status} />
        <Button label={status === "pass" ? "Re-run" : "Run"} onPress={onRun} loading={running} variant="secondary" />
      </View>
    </View>
  );
}

function createStyles(colors: ColorPalette) {
  return StyleSheet.create({
    row: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      padding: spacing.md,
      marginBottom: spacing.sm,
    },
    left: {
      flexDirection: "row",
      alignItems: "center",
      flexShrink: 1,
    },
    index: {
      color: colors.textSecondary,
      fontFamily: "monospace",
      marginRight: spacing.sm,
      fontSize: 14,
    },
    title: {
      color: colors.textPrimary,
      fontSize: 14,
      fontWeight: "600",
      flexShrink: 1,
    },
    right: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
    },
  });
}
