import React, { useMemo } from "react";
import { Modal, Pressable, StyleSheet, View } from "react-native";
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
      <Pressable style={styles.backdrop} onPress={dismiss}>
        <Pressable style={styles.card} onPress={() => {}}>
          {current ? (
            <>
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
    message: { color: colors.textSecondary, fontSize: 14, lineHeight: 20, marginBottom: spacing.lg, textAlign: "justify" },
    buttonRow: { flexDirection: "row", gap: spacing.sm },
    buttonSingle: {},
    buttonHalf: { flex: 1 },
    buttonFull: {},
  });
}
