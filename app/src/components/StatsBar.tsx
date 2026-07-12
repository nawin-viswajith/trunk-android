import React, { useMemo } from "react";
import { StyleSheet, View } from "react-native";
import { Text } from "./Text";
import { ColorPalette, spacing } from "../theme/colors";
import { useColors } from "../theme/ThemeContext";

interface StatsBarProps {
  left: string;
  right: string;
}

/** Bottom stats row shared by Models/Projects/Playground. The two halves
 * are independent flex columns around a fixed middle dot, so the dot sits
 * at the exact screen center regardless of either side's text length —
 * a plain centered single string would let the dot drift whenever a count
 * changes digit-width, which reads as a small jerk. */
export function StatsBar({ left, right }: StatsBarProps) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <View style={styles.bar}>
      <Text style={styles.side} numberOfLines={1}>
        {left}
      </Text>
      <Text style={styles.dot}>·</Text>
      <Text style={[styles.side, styles.sideRight]} numberOfLines={1}>
        {right}
      </Text>
    </View>
  );
}

function createStyles(colors: ColorPalette) {
  return StyleSheet.create({
    bar: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.surfaceAlt,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      paddingVertical: spacing.xs,
      paddingHorizontal: spacing.md,
    },
    side: { flex: 1, color: colors.textSecondary, fontSize: 11, textAlign: "right" },
    sideRight: { textAlign: "left" },
    dot: { color: colors.textSecondary, fontSize: 11, marginHorizontal: spacing.xs },
  });
}
