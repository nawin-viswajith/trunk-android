import React, { useMemo, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Text } from "./Text";
import { MarkdownText } from "./MarkdownText";
import { ColorPalette, spacing } from "../theme/colors";
import { useColors } from "../theme/ThemeContext";
import { formatInferenceStats } from "../utils/format";

export interface FlowStepSummary {
  id: string;
  agentName: string;
  output: string;
  /** Full in/out breakdown - rendered via formatInferenceStats so a step's
   * numbers read the same way the final aggregate line already does,
   * instead of one bare, ambiguous tok/s figure. */
  promptTokens: number;
  tokensGenerated: number;
  promptTokensPerSecond: number;
  tokensPerSecond: number;
  totalMs: number;
}

interface FlowStepsAccordionProps {
  steps: FlowStepSummary[];
  /** Shown while a step is still generating - its row renders expanded and
   * live-updating regardless of collapse state, since watching it work is
   * the point. */
  activeStep?: { agentName: string; partialText: string } | null;
}

const ACTIVE_STEP_ID = "__active__";

/** Every agent's output collapsed behind a tap, including the one currently
 * streaming - so a multi-step flow reads as a short list of names instead
 * of a wall of text while it's working, matching Gemini/Claude's pattern
 * instead of forcing the live output open. The user's own final answer
 * (rendered separately by the caller, e.g. the chat bubble or "FINAL
 * RESULT" card) is what's meant to be seen by default; these are the "show
 * your work" steps behind it. */
export function FlowStepsAccordion({ steps, activeStep }: FlowStepsAccordionProps) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (steps.length === 0 && !activeStep) return null;

  return (
    <View style={styles.wrap}>
      {steps.map((step, index) => {
        const expanded = expandedId === step.id;
        return (
          <View key={step.id} style={styles.row}>
            <Pressable onPress={() => setExpandedId(expanded ? null : step.id)} style={styles.header}>
              <Text style={styles.stepNumber}>{index + 1}</Text>
              <Text style={styles.agentName} numberOfLines={1}>
                {step.agentName}
              </Text>
              <Text style={styles.meta}>{step.tokensPerSecond.toFixed(1)} tok/s out</Text>
              <Text style={styles.caret}>{expanded ? "▲" : "▼"}</Text>
            </Pressable>
            {expanded ? (
              <View style={styles.body}>
                <Text style={styles.stepStats}>{formatInferenceStats(step)}</Text>
                <MarkdownText content={step.output} textStyle={styles.bodyText} />
              </View>
            ) : null}
          </View>
        );
      })}
      {activeStep ? (
        <View style={styles.row}>
          <Pressable
            onPress={() => setExpandedId(expandedId === ACTIVE_STEP_ID ? null : ACTIVE_STEP_ID)}
            style={styles.header}
          >
            <Text style={styles.stepNumber}>{steps.length + 1}</Text>
            <Text style={styles.agentName} numberOfLines={1}>
              {activeStep.agentName} — working…
            </Text>
            <Text style={styles.caret}>{expandedId === ACTIVE_STEP_ID ? "▲" : "▼"}</Text>
          </Pressable>
          {expandedId === ACTIVE_STEP_ID && activeStep.partialText ? (
            <View style={styles.body}>
              <MarkdownText content={activeStep.partialText} textStyle={styles.bodyText} />
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

function createStyles(colors: ColorPalette) {
  return StyleSheet.create({
    wrap: { marginTop: spacing.xs, marginBottom: spacing.xs, gap: spacing.xs },
    row: { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceAlt },
    header: { flexDirection: "row", alignItems: "center", padding: spacing.sm, gap: spacing.xs },
    stepNumber: { color: colors.accentSecondary, fontSize: 11, fontWeight: "700", fontFamily: "monospace" },
    agentName: { flex: 1, color: colors.textPrimary, fontSize: 12, fontWeight: "600" },
    meta: { color: colors.running, fontSize: 10, fontFamily: "monospace" },
    caret: { color: colors.textSecondary, fontSize: 10 },
    body: { borderTopWidth: 1, borderTopColor: colors.border, padding: spacing.sm },
    stepStats: { color: colors.running, fontSize: 10, fontFamily: "monospace", marginBottom: spacing.xs },
    bodyText: { color: colors.textPrimary, fontSize: 13, lineHeight: 18 },
  });
}
