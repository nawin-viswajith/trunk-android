import React, { useEffect, useMemo, useState } from "react";
import { Modal, Pressable, StyleSheet, View } from "react-native";
import { Text } from "./Text";
import { Button } from "./Button";
import { CheckIndicator } from "./CheckIndicator";
import { useNetworkPromptStore } from "../state/useNetworkPromptStore";
import { ColorPalette, spacing } from "../theme/colors";
import { useColors } from "../theme/ThemeContext";

/** Mounted once at the app root (see AppNavigator.tsx) — asks before a
 * download proceeds on cellular data, with a "remember my choice" checkbox
 * that lets downloadPolicy.ts skip this prompt from then on. */
export function NetworkPromptModal() {
  const pending = useNetworkPromptStore((s) => s.pending);
  const respond = useNetworkPromptStore((s) => s.respond);
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [remember, setRemember] = useState(false);

  useEffect(() => {
    if (pending) setRemember(false);
  }, [pending]);

  return (
    <Modal visible={!!pending} transparent animationType="fade" onRequestClose={() => respond(false, false)}>
      <Pressable style={styles.backdrop} onPress={() => {}}>
        <Pressable style={styles.card} onPress={() => {}}>
          {pending ? (
            <>
              <Text style={styles.title}>You're on mobile data</Text>
              <Text style={styles.message}>
                Downloading {pending.filename} will use your mobile data instead of Wi-Fi. Continue?
              </Text>
              <Pressable style={styles.checkboxRow} onPress={() => setRemember((r) => !r)} hitSlop={8}>
                <CheckIndicator checked={remember} />
                <Text style={styles.checkboxLabel}>Remember my choice</Text>
              </Pressable>
              <View style={styles.buttonRow}>
                <View style={styles.buttonHalf}>
                  <Button label="Wi-Fi only" variant="neutral" onPress={() => respond(false, remember)} />
                </View>
                <View style={styles.buttonHalf}>
                  <Button label="Continue" variant="primary" onPress={() => respond(true, remember)} />
                </View>
              </View>
            </>
          ) : null}
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
    },
    title: { color: colors.textPrimary, fontSize: 17, fontWeight: "700", marginBottom: spacing.sm },
    message: { color: colors.textSecondary, fontSize: 14, lineHeight: 20 },
    checkboxRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: spacing.md },
    checkboxLabel: { color: colors.textPrimary, fontSize: 13 },
    buttonRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.lg },
    buttonHalf: { flex: 1 },
  });
}
