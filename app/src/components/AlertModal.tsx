import React, { useMemo } from "react";
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Text } from "./Text";
import { Button } from "./Button";
import { useAlertStore } from "../state/useAlertStore";
import { ColorPalette, spacing } from "../theme/colors";
import { useColors } from "../theme/ThemeContext";

/** Mounted once at the app root (see AppNavigator.tsx) — renders whatever
 * showAlert() last pushed onto useAlertStore, anywhere in the app. */
export function AlertModalHost() {
  const current = useAlertStore((s) => s.current);
  const dismiss = useAlertStore((s) => s.dismiss);
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <Modal visible={!!current} transparent animationType="fade" onRequestClose={dismiss}>
      {/* showAlert() can fire while a TextInput's keyboard is up (e.g. a
       * validation error from a form) — without KeyboardAvoidingView, a
       * plain centered Modal doesn't reposition for the keyboard, and
       * without the ScrollView below, a message too tall for the remaining
       * space had no way to be read at all. */}
      <KeyboardAvoidingView style={styles.backdrop} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <Pressable style={styles.backdropTouchable} onPress={dismiss}>
          <Pressable style={styles.card} onPress={() => {}}>
            {current ? (
              <ScrollView bounces={false}>
                <Text style={styles.title}>{current.title}</Text>
                <Text style={styles.message}>{current.message}</Text>
                <View style={current.buttons.length > 1 ? styles.buttonRow : styles.buttonSingle}>
                  {current.buttons.map((button, i) => (
                    <View key={i} style={current.buttons.length > 1 ? styles.buttonHalf : styles.buttonFull}>
                      <Button
                        label={button.label}
                        variant={button.variant ?? "primary"}
                        onPress={() => {
                          dismiss();
                          button.onPress?.();
                        }}
                      />
                    </View>
                  ))}
                </View>
              </ScrollView>
            ) : null}
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function createStyles(colors: ColorPalette) {
  return StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.6)",
    },
    backdropTouchable: {
      flex: 1,
      justifyContent: "center",
      padding: spacing.lg,
    },
    card: {
      maxHeight: "80%",
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderTopWidth: 3,
      borderTopColor: colors.accent,
      padding: spacing.lg,
    },
    title: { color: colors.textPrimary, fontSize: 17, fontWeight: "700", marginBottom: spacing.sm },
    message: { color: colors.textSecondary, fontSize: 14, lineHeight: 20, marginBottom: spacing.lg, textAlign: "justify" },
    buttonRow: { flexDirection: "row", gap: spacing.sm },
    buttonSingle: {},
    buttonHalf: { flex: 1 },
    buttonFull: {},
  });
}
