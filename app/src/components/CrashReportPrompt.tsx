import React, { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Modal, Pressable, StyleSheet, View } from "react-native";
import { Text } from "./Text";
import { useCrashReportStore } from "../state/useCrashReportStore";
import { sendQueuedReport, markReportStatus } from "../services/crashReportQueue";
import { showAlert } from "../state/useAlertStore";
import { ColorPalette, spacing } from "../theme/colors";
import { useColors } from "../theme/ThemeContext";

const AUTO_SEND_MS = 5000;

type SendState = "idle" | "sending" | "sent";

/** Mounted once at the app root (see AppNavigator.tsx) — offers to file a
 * GitHub issue whenever offerCrashReport() fires (model load/generate
 * failures - see ProjectDetailScreen.tsx/InferenceScreen.tsx), auto-sending
 * after AUTO_SEND_MS unless the user cancels first. Modal + pointerEvents
 * "box-none" (rather than an absolutely-positioned View) so it overlays above
 * the tab bar the same reliable way AlertModalHost/NetworkPromptModal do,
 * while still letting touches outside the bar itself reach the screen below —
 * this is meant to read as a dismissible toast, not a blocking dialog.
 *
 * A report already has a durable "pending" record in crashReportQueue.ts by
 * the time this ever shows (see offerCrashReport) - this component's job is
 * just to attempt the send and update that record's status to sent/failed/
 * cancelled, not to be the only place the report is ever recorded. */
export function CrashReportPrompt() {
  const pending = useCrashReportStore((s) => s.pending);
  const dismiss = useCrashReportStore((s) => s.dismiss);
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [sendState, setSendState] = useState<SendState>("idle");
  const progress = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!pending) return;
    setSendState("idle");
    progress.setValue(1);
    const anim = Animated.timing(progress, {
      toValue: 0,
      duration: AUTO_SEND_MS,
      useNativeDriver: false,
    });
    // send() is declared further down in this same component body - safe to
    // reference here since this callback only runs once the animation
    // actually completes (5s later), long after that declaration has run.
    anim.start(({ finished }) => {
      if (finished) send();
    });
    return () => anim.stop();
  }, [pending, progress, dismiss]);

  const send = async () => {
    if (!pending) return;
    // Freezes the countdown bar right where it is - without this, the
    // auto-dismiss timer keeps running underneath a "sending"/"sent" state
    // and could close the prompt mid-request or right as "sent" appears.
    progress.stopAnimation();
    setSendState("sending");
    try {
      await sendQueuedReport(pending);
      await markReportStatus(pending.id, "sent");
      setSendState("sent");
      setTimeout(dismiss, 1200);
    } catch (err) {
      // Left as "failed", not re-queued as "pending" - retryQueuedReports()
      // (boot + network-reconnect) picks up both statuses the same way, so
      // this isn't lost, just not retried from this same screen instance.
      await markReportStatus(pending.id, "failed");
      dismiss();
      showAlert("Couldn't send report", "It'll be sent automatically once you're back online.\n\n" + String(err));
    }
  };

  const cancel = async () => {
    if (!pending) return;
    await markReportStatus(pending.id, "cancelled");
    dismiss();
  };

  return (
    <Modal visible={!!pending} transparent animationType="slide" onRequestClose={cancel}>
      <View style={styles.overlay} pointerEvents="box-none">
        {pending ? (
          <View style={styles.card}>
            <Animated.View
              style={[
                styles.timerBar,
                { backgroundColor: colors.accent, width: progress.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] }) },
              ]}
            />
            <View style={styles.row}>
              <Pressable onPress={cancel} disabled={sendState === "sending"} style={styles.sideButton} hitSlop={8}>
                <Text style={[styles.sideButtonText, { color: colors.textSecondary }]}>CANCEL</Text>
              </Pressable>
              <View style={styles.textArea}>
                <Text style={styles.title}>{sendState === "sent" ? "Report sent — thank you" : "Something went wrong"}</Text>
                {sendState !== "sent" ? (
                  <Text style={styles.message} numberOfLines={2}>
                    {pending.context}: {pending.message}
                  </Text>
                ) : null}
              </View>
              <Pressable onPress={send} disabled={sendState !== "idle"} style={styles.sideButton} hitSlop={8}>
                <Text style={[styles.sideButtonText, { color: colors.accent }]}>
                  {sendState === "sending" ? "…" : sendState === "sent" ? "✓" : "Send"}
                </Text>
              </Pressable>
            </View>
          </View>
        ) : null}
      </View>
    </Modal>
  );
}

function createStyles(colors: ColorPalette) {
  return StyleSheet.create({
    overlay: {
      flex: 1,
      justifyContent: "flex-end",
      padding: spacing.md,
    },
    card: {
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      overflow: "hidden",
    },
    timerBar: { height: 3 },
    row: {
      flexDirection: "row",
      alignItems: "center",
      padding: spacing.md,
      gap: spacing.sm,
    },
    sideButton: { paddingHorizontal: spacing.xs, paddingVertical: spacing.xs },
    sideButtonText: { fontSize: 13, fontWeight: "700" },
    textArea: { flex: 1 },
    title: { color: colors.textPrimary, fontSize: 13, fontWeight: "700" },
    message: { color: colors.textSecondary, fontSize: 11, marginTop: 2 },
  });
}
