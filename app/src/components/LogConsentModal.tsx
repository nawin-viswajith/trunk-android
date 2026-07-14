import React, { useMemo } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Text } from "./Text";
import { Button } from "./Button";
import { ColorPalette, spacing } from "../theme/colors";
import { useColors } from "../theme/ThemeContext";

interface LogConsentModalProps {
  visible: boolean;
  onAllow: () => void;
  onDecline: () => void;
}

/** Shown once, before usage logging is turned on for the first time (either
 * from the Performance settings toggle or the "Send Logs" action) — same
 * visual convention as OnboardingFlow.tsx's warning phases: a title, plain-
 * language body, and a single pair of buttons, no native Alert.alert. */
export function LogConsentModal({ visible, onAllow, onDecline }: LogConsentModalProps) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDecline}>
      <Pressable style={styles.backdrop} onPress={onDecline}>
        <Pressable style={styles.card} onPress={() => {}}>
          <Text style={styles.title}>Usage logging</Text>
          <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
            <Text style={styles.body}>
              Trunk is new, and understanding how it's actually used helps prioritize what to fix next. Usage logging
              is off by default and never required.
            </Text>
            <Text style={styles.sectionLabel}>If you turn it on, this stays on your device:</Text>
            <Text style={styles.bullet}>• Which features you use (downloads, chats, flows) and when</Text>
            <Text style={styles.bullet}>• Model load/generation timing and token counts</Text>
            <Text style={styles.bullet}>• Errors, same as the existing Failure Log</Text>
            <Text style={styles.sectionLabel}>What's never collected, logging on or off:</Text>
            <Text style={styles.bullet}>• Your prompts, model responses, or chat content</Text>
            <Text style={styles.bullet}>• Model files, files you attach, or anything from Storage Inspector</Text>
            <Text style={styles.bullet}>• Anything at all, unless you tap "Send Logs" and share it yourself</Text>
            <Text style={styles.body}>
              Nothing is ever sent automatically. Logs only leave this device when you explicitly tap "Send Logs" and
              choose where to send them, through Android's own share sheet.
            </Text>
          </ScrollView>
          <View style={styles.buttonRow}>
            <View style={styles.buttonHalf}>
              <Button label="Not now" onPress={onDecline} variant="neutral" />
            </View>
            <View style={styles.buttonHalf}>
              <Button label="Allow" onPress={onAllow} variant="primary" />
            </View>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function createStyles(colors: ColorPalette) {
  return StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.6)",
      justifyContent: "center",
      padding: spacing.lg,
    },
    card: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderTopWidth: 3,
      borderTopColor: colors.accent,
      padding: spacing.lg,
      maxHeight: "80%",
    },
    title: { color: colors.textPrimary, fontSize: 17, fontWeight: "700", marginBottom: spacing.sm },
    scroll: { marginBottom: spacing.md },
    body: { color: colors.textSecondary, fontSize: 13, lineHeight: 19, marginBottom: spacing.md },
    sectionLabel: { color: colors.textPrimary, fontSize: 12, fontWeight: "700", marginBottom: spacing.xs },
    bullet: { color: colors.textSecondary, fontSize: 12, lineHeight: 18, marginBottom: spacing.xs },
    buttonRow: { flexDirection: "row", gap: spacing.sm },
    buttonHalf: { flex: 1 },
  });
}
