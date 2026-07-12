import React, { useMemo } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Text } from "../Text";
import { CheckIndicator } from "../CheckIndicator";
import { spacing, ColorPalette } from "../../theme/colors";
import { useColors } from "../../theme/ThemeContext";
import { Flow } from "../../state/useFlowStore";

interface FlowCardProps {
  flow: Flow;
  onPress: () => void;
  onLongPress?: () => void;
  selectionMode?: boolean;
  selected?: boolean;
}

export function FlowCard({ flow, onPress, onLongPress, selectionMode, selected }: FlowCardProps) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      style={({ pressed }) => [styles.card, selected && styles.cardSelected, pressed && styles.cardPressed]}
    >
      <View style={styles.textWrap}>
        <Text style={styles.name}>{flow.name}</Text>
        <Text style={styles.meta}>
          {flow.nodes.length} agent{flow.nodes.length === 1 ? "" : "s"} · {flow.modelFilename ?? "No model assigned"}
        </Text>
      </View>
      {selectionMode ? <CheckIndicator checked={!!selected} /> : null}
    </Pressable>
  );
}

function createStyles(colors: ColorPalette) {
  return StyleSheet.create({
    card: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      borderWidth: 1,
      borderColor: colors.border,
      borderLeftWidth: 3,
      borderLeftColor: colors.accentTertiary,
      backgroundColor: colors.surface,
      padding: spacing.md,
      marginBottom: spacing.sm,
    },
    cardSelected: { borderColor: colors.accent, backgroundColor: colors.accent + "18" },
    cardPressed: { backgroundColor: colors.surfaceAlt },
    textWrap: { flex: 1, marginRight: spacing.sm },
    name: { color: colors.textPrimary, fontWeight: "600", fontSize: 15, marginBottom: spacing.xs },
    meta: { color: colors.textSecondary, fontSize: 12, fontFamily: "monospace" },
  });
}
