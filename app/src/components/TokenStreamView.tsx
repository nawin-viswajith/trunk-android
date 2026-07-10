import React from "react";
import { ScrollView, StyleSheet, Text } from "react-native";
import { colors, spacing } from "../theme/colors";

export function TokenStreamView({ text }: { text: string }) {
  return (
    <ScrollView style={styles.container}>
      <Text style={styles.text}>{text || "..."}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
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
