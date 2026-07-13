import React, { useEffect, useMemo, useRef, useState } from "react";
import { Keyboard, Platform, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Text } from "../../components/Text";
import { TextInput } from "../../components/TextInput";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button } from "../../components/Button";
import { MarkdownText } from "../../components/MarkdownText";
import { ContextWindowMeter } from "../../components/ContextWindowMeter";
import { AttachmentChip } from "../../components/AttachmentChip";
import { FlowStepsAccordion } from "../../components/FlowStepsAccordion";
import { runFlow, FlowProgress, FlowStepResult } from "../../services/flowRunner";
import { selectFlow, useFlowStore } from "../../state/useFlowStore";
import { ensureLoaded, countTokens, getActiveInferenceUnit } from "../../services/llamaEngine";
import { modelPath } from "../../services/modelStorage";
import { Attachment, pickTextAttachment, formatAttachmentForPrompt } from "../../services/fileAttachment";
import { logFailure } from "../../services/errorLog";
import { ColorPalette, spacing } from "../../theme/colors";
import { createScreenStyles } from "../../theme/layout";
import { useColors } from "../../theme/ThemeContext";

export function RunFlowScreen({ route, navigation }: any) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { flowId } = route.params;

  const flow = useFlowStore((s) => selectFlow(s.flows, flowId));
  const agents = useFlowStore((s) => s.agents);

  const [input, setInput] = useState("");
  const [running, setRunning] = useState(false);
  const [steps, setSteps] = useState<FlowStepResult[]>([]);
  const [activeStep, setActiveStep] = useState<FlowProgress | null>(null);
  const [finalResult, setFinalResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [attachment, setAttachment] = useState<Attachment | null>(null);
  const [attachError, setAttachError] = useState<string | null>(null);
  const [liveTokenEstimate, setLiveTokenEstimate] = useState(0);
  const [inferenceUnit, setInferenceUnit] = useState<string | null>(null);
  const listRef = useRef<ScrollView>(null);
  // Same reasoning as InferenceScreen: streaming steps grow the content
  // constantly, and without this check every token would force-scroll back
  // down, making it impossible to scroll up and read an earlier step while
  // the flow is still running.
  const isNearBottomRef = useRef(true);
  const onListScroll = (e: { nativeEvent: { contentOffset: { y: number }; layoutMeasurement: { height: number }; contentSize: { height: number } } }) => {
    const { contentOffset, layoutMeasurement, contentSize } = e.nativeEvent;
    isNearBottomRef.current = contentOffset.y + layoutMeasurement.height >= contentSize.height - 80;
  };
  const scrollToEndIfNearBottom = () => {
    if (isNearBottomRef.current) listRef.current?.scrollToEnd({ animated: true });
  };

  useEffect(() => {
    // Same approach as InferenceScreen: tab bar hides on keyboard
    // (tabBarHideOnKeyboard), so padding by the raw keyboard height is
    // correct without double-counting.
    const showEvent = Platform.OS === "android" ? "keyboardDidShow" : "keyboardWillShow";
    const hideEvent = Platform.OS === "android" ? "keyboardDidHide" : "keyboardWillHide";
    const showSub = Keyboard.addListener(showEvent, (e) => setKeyboardHeight(e.endCoordinates.height));
    const hideSub = Keyboard.addListener(hideEvent, () => setKeyboardHeight(0));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  // Preload so the input's live token estimate (which needs a tokenizer)
  // is available while composing, not only once Run is actually pressed -
  // a cheap no-op via ensureLoaded's singleton reuse if already loaded.
  useEffect(() => {
    if (flow?.modelFilename) {
      ensureLoaded(modelPath(flow.modelFilename), { contextLength: flow.contextLength })
        .then(() => setInferenceUnit(getActiveInferenceUnit()))
        .catch(() => {});
    }
  }, [flow?.modelFilename, flow?.contextLength]);

  useEffect(() => {
    const attachmentText = attachment ? formatAttachmentForPrompt(attachment) + "\n\n" : "";
    const candidateText = attachmentText + input;
    if (!candidateText.trim()) {
      setLiveTokenEstimate(0);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(() => {
      countTokens(candidateText).then((count) => {
        if (!cancelled) setLiveTokenEstimate(count);
      });
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [input, attachment]);

  const onPickAttachment = async () => {
    setAttachError(null);
    try {
      const picked = await pickTextAttachment();
      if (picked) setAttachment(picked);
    } catch (err) {
      setAttachError(String(err instanceof Error ? err.message : err));
    }
  };

  if (!flow) return null;

  const run = async () => {
    if (!input.trim() || running) return;
    const initialInput = attachment ? `${formatAttachmentForPrompt(attachment)}\n\n${input.trim()}` : input.trim();
    setRunning(true);
    setSteps([]);
    setActiveStep(null);
    setFinalResult(null);
    setError(null);
    setAttachment(null);
    // Running is always "jump to the new step," even if the user had
    // scrolled up to read an earlier one - only mid-generation growth
    // should respect a manual scroll-up, not the moment Run is pressed.
    isNearBottomRef.current = true;
    try {
      const result = await runFlow(
        flow,
        agents,
        initialInput,
        (step) => {
          setSteps((cur) => [...cur, step]);
          setActiveStep(null);
          requestAnimationFrame(scrollToEndIfNearBottom);
        },
        (progress) => {
          setActiveStep(progress);
          requestAnimationFrame(scrollToEndIfNearBottom);
        }
      );
      setFinalResult(result);
    } catch (err) {
      logFailure("Playground flow run", err);
      setError(String(err));
    } finally {
      setRunning(false);
      setActiveStep(null);
    }
  };

  return (
    <View style={[styles.container, { paddingBottom: keyboardHeight ? keyboardHeight + spacing.md : 0 }]}>
      <View style={[styles.topBar, { paddingTop: Math.max(spacing.sm, insets.top) }]}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12} style={styles.backButton}>
          <Text style={styles.backButtonLabel}>‹</Text>
        </Pressable>
        <Text style={styles.flowName} numberOfLines={1}>
          {flow.name}
        </Text>
      </View>

      <ScrollView
        ref={listRef}
        style={styles.list}
        contentContainerStyle={styles.listContent}
        onScroll={onListScroll}
        scrollEventThrottle={100}
        onContentSizeChange={scrollToEndIfNearBottom}
      >
        {steps.length === 0 && !running ? (
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyTitle}>Ready to run</Text>
            <Text style={styles.emptySubtitle}>Enter an input below to start the chain.</Text>
          </View>
        ) : null}

        {/* Every intermediate agent collapsed by default — only the final
         * result (below) is meant to be read at a glance; these are the
         * "show your work" steps behind it. */}
        <FlowStepsAccordion
          steps={steps.map((s) => ({ id: s.nodeId, agentName: s.agentName, output: s.output, tokensPerSecond: s.stats.tokensPerSecond }))}
          activeStep={activeStep ? { agentName: activeStep.agentName, partialText: activeStep.partialText } : null}
        />

        {finalResult ? (
          <View style={styles.finalCard}>
            <Text style={styles.finalBadge}>FINAL RESULT</Text>
            <MarkdownText content={finalResult} textStyle={styles.finalText} />
          </View>
        ) : error ? (
          <View style={styles.finalCard}>
            <Text style={styles.errorBadge}>ERROR</Text>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}
      </ScrollView>

      <View style={styles.composer}>
        {flow.contextLength ? (
          <ContextWindowMeter usedTokens={liveTokenEstimate} maxTokens={flow.contextLength} unit={inferenceUnit ?? undefined} />
        ) : null}
        {attachment ? (
          <AttachmentChip name={attachment.name} truncated={attachment.truncated} onRemove={() => setAttachment(null)} />
        ) : null}
        {attachError ? <Text style={styles.attachErrorText}>{attachError}</Text> : null}
        <View style={styles.inputRow}>
          <Pressable onPress={onPickAttachment} disabled={running} style={styles.attachButton}>
            <Text style={styles.attachButtonLabel}>+</Text>
          </Pressable>
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder="Enter input for this flow..."
            placeholderTextColor={colors.textSecondary}
            style={styles.input}
            multiline
            editable={!running}
          />
          <Button
            label={running ? "Running..." : "▶"}
            onPress={run}
            variant="primary"
            loading={running}
            disabled={!input.trim()}
            style={styles.sendButton}
          />
        </View>
      </View>
    </View>
  );
}

function createStyles(colors: ColorPalette) {
  const screen = createScreenStyles(colors);
  return StyleSheet.create({
    container: screen.container,
    topBar: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.sm,
    },
    backButton: { paddingHorizontal: spacing.sm },
    backButtonLabel: { color: colors.accent, fontSize: 28, fontWeight: "700" },
    flowName: { flex: 1, color: colors.textPrimary, fontSize: 16, fontWeight: "700", marginHorizontal: spacing.sm },
    list: { flex: 1 },
    listContent: { padding: spacing.md, paddingBottom: spacing.xl },
    emptyWrap: { alignItems: "center", marginTop: spacing.xl, gap: spacing.xs },
    emptyTitle: { color: colors.textPrimary, fontSize: 18, fontWeight: "700" },
    emptySubtitle: { color: colors.textSecondary, fontSize: 13, textAlign: "center" },
    stepCard: {
      borderWidth: 1,
      borderColor: colors.border,
      borderTopWidth: 3,
      borderTopColor: colors.accentSecondary,
      backgroundColor: colors.surfaceAlt,
      padding: spacing.sm,
      marginBottom: spacing.sm,
    },
    stepBadge: { color: colors.accentSecondary, fontSize: 11, fontWeight: "700", marginBottom: spacing.xs },
    stepText: { color: colors.textPrimary, fontSize: 14, lineHeight: 20 },
    stepMeta: { color: colors.running, fontFamily: "monospace", fontSize: 10, marginTop: spacing.xs },
    finalCard: {
      borderWidth: 1,
      borderColor: colors.accent,
      borderTopWidth: 3,
      borderTopColor: colors.accent,
      backgroundColor: colors.accent + "18",
      padding: spacing.sm,
      marginBottom: spacing.sm,
    },
    finalBadge: { color: colors.accent, fontSize: 11, fontWeight: "700", marginBottom: spacing.xs },
    finalText: { color: colors.textPrimary, fontSize: 15, lineHeight: 21 },
    errorBadge: { color: colors.error, fontSize: 11, fontWeight: "700", marginBottom: spacing.xs },
    errorText: { color: colors.error, fontSize: 13 },
    composer: {
      borderTopWidth: 1,
      borderTopColor: colors.border,
      backgroundColor: colors.surface,
      padding: spacing.sm,
    },
    attachErrorText: { color: colors.error, fontSize: 11, marginBottom: spacing.xs },
    inputRow: {
      flexDirection: "row",
      alignItems: "flex-end",
      gap: spacing.xs,
    },
    attachButton: {
      width: 44,
      height: 44,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surfaceAlt,
      alignItems: "center",
      justifyContent: "center",
    },
    attachButtonLabel: { color: colors.textSecondary, fontSize: 18 },
    sendButton: {
      width: 44,
      height: 44,
      paddingHorizontal: 0,
      paddingVertical: 0,
    },
    input: {
      flex: 1,
      borderWidth: 1,
      borderColor: colors.border,
      color: colors.textPrimary,
      backgroundColor: colors.surfaceAlt,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.sm,
      maxHeight: 100,
    },
  });
}
