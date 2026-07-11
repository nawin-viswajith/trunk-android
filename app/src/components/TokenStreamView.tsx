import React, { useMemo } from "react";
import { ScrollView, StyleSheet, Text } from "react-native";
import { spacing, ColorPalette } from "../theme/colors";
import { useColors } from "../theme/ThemeContext";

export function TokenStreamView({ text }: { text: string }) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <ScrollView style={styles.container}>
      <Text style={styles.text}>{text || "..."}</Text>
    </ScrollView>
  );
}

function createStyles(colors: ColorPalette) {
  return StyleSheet.create({
    container: {
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surfaceAlt,
      padding: spacing.md,
      flex: 1,
    },
    text: {
      color: colors.textPrimary,
      fontFamily: "monospace",
      fontSize: 13,
      lineHeight: 20,
    },
  });
}
