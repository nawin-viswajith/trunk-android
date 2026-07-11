import React, { PropsWithChildren, useMemo } from "react";
import { StyleSheet, View, ViewStyle } from "react-native";
import { spacing, ColorPalette } from "../theme/colors";
import { useColors } from "../theme/ThemeContext";

export function Card({ children, style }: PropsWithChildren<{ style?: ViewStyle }>) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return <View style={[styles.card, style]}>{children}</View>;
}

function createStyles(colors: ColorPalette) {
  return StyleSheet.create({
    card: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.md,
      marginBottom: spacing.sm,
      // deliberately no borderRadius - flat, sharp-edged design
    },
  });
}
