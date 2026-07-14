import React, { useMemo } from "react";
import { StyleSheet, View } from "react-native";
import { Text } from "./Text";
import { ColorPalette, spacing } from "../theme/colors";
import { useColors } from "../theme/ThemeContext";

interface ContextWindowMeterProps {
  /** Tokens used by the conversation so far (prior turns only) - stable
   * until the next exchange actually completes, deliberately not
   * recalculated on every keystroke (see draftTokens for that). */
  usedTokens: number;
  maxTokens: number;
  /** Prefixes the count, e.g. "This step" vs "Last response" - so the same
   * meter can show a live pre-send estimate or a post-hoc actual figure
   * without the caller needing its own label. */
  label?: string;
  /** "CPU" / "NPU" / "GPU" - whichever unit the loaded context is actually
   * running on, shown on the same line so it's visible right where the
   * token budget already is instead of needing its own row. */
  unit?: string;
  /** Live token count of whatever's currently typed but not sent yet -
   * shown on the right of the same line, separate from usedTokens, so
   * typing doesn't make the main total look like it's glitching up and
   * down. Included in the over-budget check alongside usedTokens. */
  draftTokens?: number;
}

/** A model's context window is a hard ceiling, not a soft budget - once a
 * prompt exceeds n_ctx, llama.cpp errors out instead of truncating for you.
 * This surfaces the fraction being used, in both Inference and Playground,
 * so that failure is visible coming rather than a surprise mid-send. */
export function ContextWindowMeter({ usedTokens, maxTokens, label, unit, draftTokens }: ContextWindowMeterProps) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  if (!maxTokens) return null;

  const projectedTokens = usedTokens + (draftTokens ?? 0);
  const fraction = Math.min(1, projectedTokens / maxTokens);
  const overBudget = projectedTokens > maxTokens;
  const barColor = overBudget || fraction >= 0.9 ? colors.error : fraction >= 0.7 ? colors.warning : colors.running;

  return (
    <View style={styles.wrap}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>
          {unit ? `${unit} · ` : ""}
          {label ? `${label} · ` : ""}
          {usedTokens.toLocaleString()} / {maxTokens.toLocaleString()} tokens
        </Text>
        {overBudget ? (
          <Text style={[styles.label, { color: colors.error }]}>Over context window</Text>
        ) : draftTokens ? (
          <Text style={styles.label}>+{draftTokens.toLocaleString()} to send</Text>
        ) : null}
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${fraction * 100}%`, backgroundColor: barColor }]} />
      </View>
    </View>
  );
}

function createStyles(colors: ColorPalette) {
  return StyleSheet.create({
    wrap: { marginBottom: spacing.xs },
    labelRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 2 },
    label: { color: colors.textSecondary, fontSize: 10, fontFamily: "monospace" },
    track: { height: 3, backgroundColor: colors.surfaceAlt, overflow: "hidden" },
    fill: { height: 3 },
  });
}
