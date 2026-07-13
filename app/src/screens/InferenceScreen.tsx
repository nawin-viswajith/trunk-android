import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FlatList, Keyboard, Platform, Pressable, StyleSheet, View } from "react-native";
import { Text } from "../components/Text";
import { TextInput } from "../components/TextInput";
import { Button } from "../components/Button";
import { ChatBubble } from "../components/ChatBubble";
import { PickerModal } from "../components/PickerModal";
import { GuideStep } from "../components/PageGuideModal";
import { ScreenHeader } from "../components/ScreenHeader";
import { ContextWindowMeter } from "../components/ContextWindowMeter";
import { AttachmentChip } from "../components/AttachmentChip";
import { ColorPalette, spacing } from "../theme/colors";
import { createScreenStyles } from "../theme/layout";
import { useColors } from "../theme/ThemeContext";
import {
  useProjectStore,
  selectProject,
  selectHistoryForSession,
  selectSessionsForProject,
} from "../state/useProjectStore";
import { modelPath, isModelDownloaded } from "../services/modelStorage";
import { ensureLoaded, complete, countTokens, getActiveInferenceUnit } from "../services/llamaEngine";
import { runFlow, FlowStepResult } from "../services/flowRunner";
import { FlowStepsAccordion } from "../components/FlowStepsAccordion";
import { useFlowStore } from "../state/useFlowStore";
import { formatInferenceStats } from "../utils/format";
import { useSettingsStore } from "../state/useSettingsStore";
import { showAlert } from "../state/useAlertStore";
import { Attachment, pickTextAttachment, formatAttachmentForPrompt } from "../services/fileAttachment";
import { logFailure } from "../services/errorLog";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  meta?: string;
}

const NEW_CHAT_VALUE = "__new__";
const NO_FLOW_VALUE = "__none__";
// Heuristic cap on how many prior exchanges get replayed into the model's
// context each turn — keeps prompt size bounded on long-running chats
// without needing to reason about the project's exact context_length in tokens.
const MAX_CONTEXT_EXCHANGES = 10;

const PLACEHOLDER_TEXTS = [
  "Ask me anything...",
  "What can I help you with?",
  "Type your message here...",
  "Let's get started...",
  "How can I assist today?",
  "Say hello to begin...",
  "What's on your mind?",
  "Start typing to chat...",
  "Need help with something?",
  "Write your first message...",
  "Hey, what are we building?",
  "Ready when you are...",
  "Got a question? Ask away...",
  "Type here to chat...",
  "What would you like to know?",
];

function randomPlaceholder(): string {
  return PLACEHOLDER_TEXTS[Math.floor(Math.random() * PLACEHOLDER_TEXTS.length)];
}

const GUIDE_STEPS: GuideStep[] = [
  {
    title: "Pick what to chat with",
    description: "The Project chip picks which model + settings you're using. The Flow chip optionally routes your message through a saved agent chain instead of straight to the model.",
  },
  {
    title: "Chats",
    description: "The Chat chip switches between sessions for the current project, or starts a new one — each keeps its own separate history.",
  },
  {
    title: "Send & stream",
    description: "Type a message and send it — the response streams token-by-token, fully on-device.",
  },
  {
    title: "Stats",
    description: "Turn on inference stats in Settings to see token count and tokens/second under each reply.",
  },
];

export function InferenceScreen({ route, navigation }: any) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const projectIdParam: string | undefined = route?.params?.projectId;

  const projects = useProjectStore((s) => s.projects);
  const sessions = useProjectStore((s) => s.sessions);
  const history = useProjectStore((s) => s.history);
  const addHistoryEntry = useProjectStore((s) => s.addHistoryEntry);
  const createSession = useProjectStore((s) => s.createSession);
  const ensureDefaultSession = useProjectStore((s) => s.ensureDefaultSession);
  const showInferenceStats = useSettingsStore((s) => s.showInferenceStats);
  const flows = useFlowStore((s) => s.flows);
  const agents = useFlowStore((s) => s.agents);
  const [activeProjectId, setActiveProjectId] = useState<string | undefined>(projectIdParam);
  const [activeSessionId, setActiveSessionId] = useState<string | undefined>(undefined);
  const [activeFlowId, setActiveFlowId] = useState<string | undefined>(undefined);
  const [prompt, setPrompt] = useState("");
  const [running, setRunning] = useState(false);
  // Scoped to the session it was sent from — otherwise switching chats/
  // projects mid-generation would show this session's still-streaming
  // tokens rendering inside whichever session the user switched to.
  const [pendingExchange, setPendingExchange] = useState<{ sessionId: string; prompt: string; output: string } | null>(
    null
  );
  const [projectPickerOpen, setProjectPickerOpen] = useState(false);
  const [sessionPickerOpen, setSessionPickerOpen] = useState(false);
  const [flowPickerOpen, setFlowPickerOpen] = useState(false);
  const [placeholder, setPlaceholder] = useState(randomPlaceholder);
  const [attachment, setAttachment] = useState<Attachment | null>(null);
  const [attachError, setAttachError] = useState<string | null>(null);
  // Debounced estimate of how many tokens the NEXT message would use, so a
  // context-window overflow is visible before hitting send, not only as a
  // native error afterward. 0 while nothing loaded/nothing typed yet.
  const [liveTokenEstimate, setLiveTokenEstimate] = useState(0);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  // Null until a model has actually finished loading at least once — shown
  // next to the composer so it's visible before the user sends anything,
  // not just discoverable after the fact from response speed.
  const [inferenceUnit, setInferenceUnit] = useState<string | null>(null);
  // Live per-agent breakdown for the flow run currently in flight - cleared
  // at the start of every send() and once the exchange settles, matching
  // Playground's Run screen (steps are a "watch it work" view of the
  // current run, not a persisted part of chat history).
  const [flowSteps, setFlowSteps] = useState<FlowStepResult[]>([]);
  const [activeFlowStep, setActiveFlowStep] = useState<{ agentName: string; partialText: string } | null>(null);
  const listRef = useRef<FlatList<ChatMessage>>(null);

  useEffect(() => {
    // Also covers the active project being deleted elsewhere (Projects tab
    // stays mounted alongside this one) — without this, activeProjectId
    // keeps pointing at a now-nonexistent project forever, since the guard
    // below only fires when it's already falsy.
    if (activeProjectId && !projects.some((p) => p.id === activeProjectId)) {
      setActiveProjectId(projects[0]?.id);
      return;
    }
    if (!activeProjectId && projects.length > 0) setActiveProjectId(projects[0].id);
  }, [activeProjectId, projects]);

  useEffect(() => {
    if (!activeProjectId) {
      setActiveSessionId(undefined);
      return;
    }
    const session = ensureDefaultSession(activeProjectId);
    setActiveSessionId(session.id);
  }, [activeProjectId, ensureDefaultSession]);

  useEffect(() => {
    setPlaceholder(randomPlaceholder());
  }, [activeSessionId]);

  useEffect(() => {
    // Tab bar is set to hide on keyboard (tabBarHideOnKeyboard), so it no
    // longer reserves space underneath — padding by the raw keyboard height
    // is now correct without double-counting.
    const showEvent = Platform.OS === "android" ? "keyboardDidShow" : "keyboardWillShow";
    const hideEvent = Platform.OS === "android" ? "keyboardDidHide" : "keyboardWillHide";
    const showSub = Keyboard.addListener(showEvent, (e) => setKeyboardHeight(e.endCoordinates.height));
    const hideSub = Keyboard.addListener(hideEvent, () => setKeyboardHeight(0));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const activeProject = useProjectStore((s) => (activeProjectId ? selectProject(s.projects, activeProjectId) : undefined));
  const projectSessions = useMemo(
    () => (activeProjectId ? selectSessionsForProject(sessions, activeProjectId) : []),
    [sessions, activeProjectId]
  );
  const activeSession = useMemo(
    () => projectSessions.find((s) => s.id === activeSessionId),
    [projectSessions, activeSessionId]
  );
  const activeFlow = useMemo(() => flows.find((f) => f.id === activeFlowId), [flows, activeFlowId]);
  // Flows fundamentally change how a "conversation" behaves (a different
  // agent chain instead of the model directly), so — unlike Project, which
  // already moves you to a different session when switched — nothing should
  // let flow-routed and direct-chat messages mix in one thread. Lock the
  // picker once the active session already has history.
  const sessionHasHistory = useMemo(
    () => !!activeSessionId && selectHistoryForSession(history, activeSessionId).length > 0,
    [history, activeSessionId]
  );

  const goToProjectDetail = useCallback(() => {
    if (!activeProject) return;
    navigation.navigate("Projects", {
      screen: "Project Detail",
      params: { projectId: activeProject.id, returnTo: "Inference" },
    });
  }, [activeProject, navigation]);

  const goToProjectsList = useCallback(() => {
    navigation.navigate("Projects");
  }, [navigation]);

  const messages = useMemo<ChatMessage[]>(() => {
    if (!activeSessionId) return [];
    const entries = selectHistoryForSession(history, activeSessionId).slice().reverse();
    const fromHistory: ChatMessage[] = entries.flatMap((entry) => [
      { id: `${entry.id}-u`, role: "user" as const, content: entry.prompt },
      {
        id: `${entry.id}-a`,
        role: "assistant" as const,
        content: entry.response,
        meta: showInferenceStats ? formatInferenceStats(entry) : undefined,
      },
    ]);
    if (pendingExchange && pendingExchange.sessionId === activeSessionId) {
      fromHistory.push(
        { id: "pending-u", role: "user", content: pendingExchange.prompt },
        { id: "pending-a", role: "assistant", content: pendingExchange.output }
      );
    }
    return fromHistory;
  }, [history, activeSessionId, pendingExchange, showInferenceStats]);

  // Same window of replayed history used both to actually build a request
  // and to estimate its token cost ahead of time - kept as one memo so the
  // two can never drift out of sync with each other.
  const priorTurns = useMemo(() => {
    if (!activeSessionId) return [];
    return selectHistoryForSession(history, activeSessionId)
      .slice()
      .reverse()
      .slice(-MAX_CONTEXT_EXCHANGES)
      .flatMap((h) => [
        { role: "user" as const, content: h.prompt },
        { role: "assistant" as const, content: h.response },
      ]);
  }, [history, activeSessionId]);

  // Preload the project's model as soon as it's selected, not only once the
  // first message is actually sent — otherwise the live token estimate
  // below silently reads 0 for that entire first message (countTokens needs
  // a loaded context), and the inference-unit indicator has nothing to show
  // until after a full round-trip. Direct-chat only; a Flow's model loads
  // inside runFlow itself once Run is pressed.
  useEffect(() => {
    if (activeFlow || !activeProject?.modelFilename) return;
    let cancelled = false;
    isModelDownloaded(activeProject.modelFilename).then((downloaded) => {
      if (!downloaded || cancelled) return;
      ensureLoaded(modelPath(activeProject.modelFilename!), { contextLength: activeProject.contextLength })
        .then(() => {
          if (!cancelled) setInferenceUnit(getActiveInferenceUnit());
        })
        .catch(() => {});
    });
    return () => {
      cancelled = true;
    };
  }, [activeFlow, activeProject?.modelFilename, activeProject?.contextLength]);

  useEffect(() => {
    if (activeFlow || !activeProject?.modelFilename) {
      setLiveTokenEstimate(0);
      return;
    }
    const attachmentText = attachment ? formatAttachmentForPrompt(attachment) + "\n\n" : "";
    const candidateText = [...priorTurns.map((m) => m.content), attachmentText + prompt].join("\n\n");
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
  }, [prompt, attachment, priorTurns, activeFlow, activeProject?.modelFilename]);

  const onPickAttachment = async () => {
    setAttachError(null);
    try {
      const picked = await pickTextAttachment();
      if (picked) setAttachment(picked);
    } catch (err) {
      setAttachError(String(err instanceof Error ? err.message : err));
    }
  };

  const send = useCallback(async () => {
    if (!prompt.trim() || !activeProject || !activeSessionId) return;
    const trimmedPrompt = prompt.trim();
    const currentAttachment = attachment;
    const sessionId = activeSessionId;
    setPrompt("");
    setAttachment(null);
    setPendingExchange({ sessionId, prompt: trimmedPrompt, output: "" });
    setRunning(true);
    setFlowSteps([]);
    setActiveFlowStep(null);
    try {
      const messageContent = currentAttachment
        ? `${formatAttachmentForPrompt(currentAttachment)}\n\n${trimmedPrompt}`
        : trimmedPrompt;

      if (activeFlow) {
        const result = await runFlow(
          activeFlow,
          agents,
          messageContent,
          (step) => {
            setFlowSteps((cur) => [...cur, step]);
            setActiveFlowStep(null);
          },
          (progress) => setActiveFlowStep({ agentName: progress.agentName, partialText: progress.partialText })
        );
        addHistoryEntry({
          projectId: activeProject.id,
          sessionId,
          prompt: trimmedPrompt,
          response: result,
          tokensGenerated: 0,
          tokensPerSecond: 0,
          promptTokens: 0,
          promptTokensPerSecond: 0,
          totalMs: 0,
          viaFlowId: activeFlow.id,
        });
        return;
      }

      if (!activeProject.modelFilename) return;
      if (!(await isModelDownloaded(activeProject.modelFilename))) {
        showAlert("Model not found", "This project's model is no longer downloaded. Assign a different one.");
        return;
      }

      await ensureLoaded(modelPath(activeProject.modelFilename), { contextLength: activeProject.contextLength });
      setInferenceUnit(getActiveInferenceUnit());

      let fullText = "";
      const result = await complete(
        {
          messages: [...priorTurns, { role: "user", content: messageContent }],
          temperature: activeProject.temperature,
          topP: activeProject.topP,
          topK: activeProject.topK,
          maxTokens: activeProject.maxTokens,
        },
        (token) => {
          fullText += token;
          setPendingExchange({ sessionId, prompt: trimmedPrompt, output: fullText });
        }
      );

      addHistoryEntry({
        projectId: activeProject.id,
        sessionId,
        prompt: trimmedPrompt,
        response: result.text,
        tokensGenerated: result.tokens,
        tokensPerSecond: result.tokensPerSecond,
        promptTokens: result.promptTokens,
        promptTokensPerSecond: result.promptTokensPerSecond,
        totalMs: result.totalMs,
      });
    } catch (err) {
      logFailure(activeFlow ? "Inference (via Flow)" : "Inference", err);
      showAlert("Inference error", String(err));
    } finally {
      setRunning(false);
      setPendingExchange(null);
      setActiveFlowStep(null);
    }
  }, [activeProject, activeSessionId, activeFlow, agents, prompt, attachment, priorTurns, addHistoryEntry]);

  return (
    <View style={[styles.container, { paddingBottom: keyboardHeight ? keyboardHeight + spacing.md : 0 }]}>
      <ScreenHeader title="Inference" showActions guideSteps={GUIDE_STEPS} />
      <View style={styles.switcherRow}>
        <Pressable
          onPress={() => setProjectPickerOpen(true)}
          disabled={running}
          style={({ pressed }) => [styles.switcherChip, pressed && styles.switcherChipPressed, running && styles.switcherChipDisabled]}
        >
          <Text style={styles.switcherRole}>Project</Text>
          <View style={styles.switcherValueRow}>
            <Text style={styles.switcherLabel} numberOfLines={1}>
              {activeProject?.name ?? "None"}
            </Text>
            <Text style={styles.switcherCaret}>›</Text>
          </View>
        </Pressable>
        <Pressable
          onPress={() => activeProject && setSessionPickerOpen(true)}
          disabled={running}
          style={({ pressed }) => [styles.switcherChip, pressed && styles.switcherChipPressed, running && styles.switcherChipDisabled]}
        >
          <Text style={styles.switcherRole}>Chat</Text>
          <View style={styles.switcherValueRow}>
            <Text style={styles.switcherLabel} numberOfLines={1}>
              {activeSession?.name ?? "None"}
            </Text>
            <Text style={styles.switcherCaret}>›</Text>
          </View>
        </Pressable>
        <Pressable
          onPress={goToProjectDetail}
          disabled={running}
          style={({ pressed }) => [styles.switcherChip, pressed && styles.switcherChipPressed, running && styles.switcherChipDisabled]}
        >
          <Text style={styles.switcherRole}>Model</Text>
          <View style={styles.switcherValueRow}>
            <Text style={styles.switcherLabel} numberOfLines={1}>
              {activeProject?.modelFilename ?? "None"}
            </Text>
            <Text style={styles.switcherCaret}>›</Text>
          </View>
        </Pressable>
        <Pressable
          onPress={() => {
            if (sessionHasHistory) {
              showAlert(
                "Flow locked for this chat",
                "Flows are locked once a chat has messages, so a conversation never mixes flow-routed and direct responses. Start a new chat (via the Chat picker) to use a different flow.",
                [{ label: "OK" }]
              );
              return;
            }
            setFlowPickerOpen(true);
          }}
          disabled={running}
          style={({ pressed }) => [styles.switcherChip, pressed && styles.switcherChipPressed, running && styles.switcherChipDisabled]}
        >
          <Text style={styles.switcherRole}>Flow</Text>
          <View style={styles.switcherValueRow}>
            <Text style={styles.switcherLabel} numberOfLines={1}>
              {activeFlow?.name ?? "Direct chat"}
            </Text>
            <Text style={styles.switcherCaret}>›</Text>
          </View>
        </Pressable>
      </View>

      <PickerModal
        visible={projectPickerOpen}
        title="Switch project"
        options={projects.map((p) => ({ label: p.name, value: p.id }))}
        selectedValue={activeProjectId}
        onSelect={setActiveProjectId}
        onClose={() => setProjectPickerOpen(false)}
        emptyLabel="No projects yet - create one in the Projects tab."
      />
      <PickerModal
        visible={sessionPickerOpen}
        title="Chat sessions"
        options={[{ label: "+ New Chat", value: NEW_CHAT_VALUE }, ...projectSessions.map((s) => ({ label: s.name, value: s.id }))]}
        selectedValue={activeSessionId}
        onSelect={(value) => {
          if (value === NEW_CHAT_VALUE) {
            if (!activeProject) return;
            const session = createSession(activeProject.id);
            setActiveSessionId(session.id);
          } else {
            setActiveSessionId(value);
          }
        }}
        onClose={() => setSessionPickerOpen(false)}
      />
      <PickerModal
        visible={flowPickerOpen}
        title="Run via Flow"
        options={[{ label: "Direct chat (no Flow)", value: NO_FLOW_VALUE }, ...flows.map((f) => ({ label: f.name, value: f.id }))]}
        selectedValue={activeFlowId ?? NO_FLOW_VALUE}
        onSelect={(value) => setActiveFlowId(value === NO_FLOW_VALUE ? undefined : value)}
        onClose={() => setFlowPickerOpen(false)}
        emptyLabel="No saved flows yet - build one in the Playground tab."
      />

      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => <ChatBubble role={item.role} content={item.content} meta={item.meta} />}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
        ListEmptyComponent={
          !activeProject ? (
            <View style={styles.emptyState}>
              <Text style={styles.empty}>No project selected yet.</Text>
              <Pressable onPress={goToProjectsList}>
                <Text style={styles.emptyLink}>Create one in Projects ›</Text>
              </Pressable>
            </View>
          ) : !activeProject.modelFilename ? (
            <View style={styles.emptyState}>
              <Text style={styles.empty}>This project has no model assigned yet.</Text>
              <Pressable onPress={goToProjectDetail}>
                <Text style={styles.emptyLink}>Assign a model in Project Detail ›</Text>
              </Pressable>
            </View>
          ) : (
            <Text style={styles.empty}>Send a prompt to start chatting with this project's model.</Text>
          )
        }
        ListFooterComponent={
          activeFlow && (flowSteps.length > 0 || activeFlowStep) ? (
            <FlowStepsAccordion
              steps={flowSteps.map((s) => ({
                id: s.nodeId,
                agentName: s.agentName,
                output: s.output,
                tokensPerSecond: s.stats.tokensPerSecond,
              }))}
              activeStep={activeFlowStep}
            />
          ) : null
        }
      />

      <View style={styles.composer}>
        {!activeFlow && activeProject?.contextLength ? (
          <ContextWindowMeter usedTokens={liveTokenEstimate} maxTokens={activeProject.contextLength} unit={inferenceUnit ?? undefined} />
        ) : null}
        {attachment ? (
          <AttachmentChip name={attachment.name} truncated={attachment.truncated} onRemove={() => setAttachment(null)} />
        ) : null}
        {attachError ? <Text style={styles.attachError}>{attachError}</Text> : null}
        <View style={styles.promptRow}>
          <Pressable onPress={onPickAttachment} disabled={running} style={styles.attachButton}>
            <Text style={styles.attachButtonLabel}>📎</Text>
          </Pressable>
          <TextInput
            value={prompt}
            onChangeText={setPrompt}
            placeholder={placeholder}
            placeholderTextColor={colors.textSecondary}
            style={styles.input}
            multiline
          />
          <Button
            label="➤"
            onPress={send}
            loading={running}
            disabled={activeFlow ? !(activeFlow.modelFilename && activeFlow.startNodeId) : !activeProject?.modelFilename}
            labelStyle={styles.sendIcon}
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
    switcherRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, paddingHorizontal: spacing.md, paddingBottom: spacing.sm },
    switcherChip: {
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      paddingVertical: spacing.xs,
      paddingHorizontal: spacing.sm,
      flexBasis: 0,
      flexGrow: 1,
    },
    switcherChipPressed: { backgroundColor: colors.surfaceAlt },
    switcherChipDisabled: { opacity: 0.5 },
    switcherRole: { color: colors.textSecondary, fontSize: 10, fontWeight: "600", textTransform: "uppercase" },
    switcherValueRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 },
    switcherLabel: { color: colors.textPrimary, fontSize: 13, fontWeight: "600", lineHeight: 18, flexShrink: 1 },
    switcherCaret: { color: colors.textSecondary, fontSize: 20, fontWeight: "700", lineHeight: 18 },
    list: { paddingHorizontal: spacing.md, paddingBottom: spacing.sm, flexGrow: 1 },
    empty: { color: colors.textSecondary, textAlign: "center", marginTop: spacing.lg },
    emptyState: { alignItems: "center", marginTop: spacing.lg, gap: spacing.sm },
    emptyLink: { color: colors.accent, fontSize: 13, fontWeight: "600" },
    composer: {
      paddingHorizontal: spacing.md,
      paddingTop: spacing.sm,
      paddingBottom: spacing.sm,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    attachError: { color: colors.error, fontSize: 11, marginBottom: spacing.xs },
    promptRow: {
      flexDirection: "row",
      gap: spacing.sm,
      alignItems: "stretch",
    },
    attachButton: {
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: spacing.sm,
    },
    attachButtonLabel: { color: colors.textSecondary, fontSize: 18 },
    input: {
      flex: 1,
      borderWidth: 1,
      borderColor: colors.border,
      color: colors.textPrimary,
      backgroundColor: colors.surface,
      padding: spacing.sm,
      minHeight: 44,
      maxHeight: 120,
    },
    sendIcon: { fontSize: 22, lineHeight: 24 },
  });
}
