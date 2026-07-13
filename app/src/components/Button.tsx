import React from "react";
import { ActivityIndicator, Pressable, StyleSheet, StyleProp, TextStyle, ViewStyle } from "react-native";
import { Text } from "./Text";
import { spacing } from "../theme/colors";
import { useColors } from "../theme/ThemeContext";

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "danger" | "neutral";
  disabled?: boolean;
  loading?: boolean;
  /** Override for icon-glyph labels (e.g. the send arrow) that need a
   * larger size than normal text labels. */
  labelStyle?: TextStyle;
  /** Override for the pressable container - e.g. a fixed square size for an
   * icon-only send button instead of the default text-button padding. */
  style?: StyleProp<ViewStyle>;
}

// One template for every variant: unfilled, border and text the same color,
// centered label. Variants differ only in which color they use — no
// per-variant fill/solid special cases, so buttons read as one consistent
// class throughout the app rather than each screen inventing its own look.
export function Button({ label, onPress, variant = "primary", disabled, loading, labelStyle, style }: ButtonProps) {
  const colors = useColors();
  const VARIANT_COLOR: Record<string, string> = {
    primary: colors.accent,
    secondary: colors.accentSecondary,
    danger: colors.error,
    neutral: colors.textSecondary,
  };
  const color = VARIANT_COLOR[variant];
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.button,
        { borderColor: color },
        (disabled || loading) && styles.disabled,
        pressed && { backgroundColor: color + "22" },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={color} />
      ) : (
        <Text style={[styles.label, { color }, labelStyle]}>{label}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    borderWidth: 1,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    alignItems: "center",
    justifyContent: "center",
    // no borderRadius - sharp edges
  },
  label: {
    fontWeight: "600",
    fontSize: 14,
  },
  disabled: {
    opacity: 0.4,
  },
  pressed: {
    opacity: 0.7,
  },
});
