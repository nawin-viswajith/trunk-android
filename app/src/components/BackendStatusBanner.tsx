import React, { useMemo } from "react";
import { StyleSheet, View } from "react-native";
import { Text } from "./Text";
import { Button } from "./Button";
import { IndeterminateProgressBar } from "./IndeterminateProgressBar";
import { BackendHealthStatus } from "../services/backendHealth";
import { ColorPalette, spacing } from "../theme/colors";
import { useColors } from "../theme/ThemeContext";

/** Shown above Hugging Face search/files while the backend is unreachable -
 * Render's free tier spins down after idle, so the first request after a
 * lull can take 30-50s. "checking" shows a progress bar with no action;
 * "offline" shows a Retry button. Renders nothing once "online". */
export function BackendStatusBanner({ status, onRetry }: { status: BackendHealthStatus; onRetry: () => void }) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  if (status === "online") return null;

  return (
    <View style={styles.banner}>
      {status === "checking" ? (
        <>
          <Text style={styles.text}>Connecting to server...</Text>
          <IndeterminateProgressBar />
        </>
      ) : (
        <View style={styles.offlineRow}>
          <Text style={styles.text}>Couldn't reach the server.</Text>
          <Button label="Retry" variant="secondary" onPress={onRetry} />
        </View>
      )}
    </View>
  );
}

function createStyles(colors: ColorPalette) {
  return StyleSheet.create({
    banner: {
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      padding: spacing.sm,
      marginBottom: spacing.md,
      gap: spacing.xs,
    },
    text: { color: colors.textSecondary, fontSize: 12 },
    offlineRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm },
  });
}
