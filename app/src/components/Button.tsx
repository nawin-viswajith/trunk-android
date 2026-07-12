import React from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text } from "react-native";
import { spacing } from "../theme/colors";
import { useColors } from "../theme/ThemeContext";

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "danger";
  disabled?: boolean;
  loading?: boolean;
}

export function Button({ label, onPress, variant = "primary", disabled, loading }: ButtonProps) {
  const colors = useColors();
  const VARIANT_COLOR: Record<string, string> = {
    primary: colors.cpu,
    secondary: colors.border,
    danger: colors.error,
  };
  const color = VARIANT_COLOR[variant];
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.button,
        { borderColor: color, backgroundColor: variant === "secondary" ? "transparent" : color + "22" },
        (disabled || loading) && styles.disabled,
        pressed && styles.pressed,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={color} />
      ) : (
        <Text style={[styles.label, { color }]}>{label}</Text>
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
    // no borderRadius -- sharp edges
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
