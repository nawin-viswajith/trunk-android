import React, { useMemo } from "react";
import { Linking, Pressable, ScrollView, Share, StyleSheet, View } from "react-native";
import { Text } from "../../components/Text";
import { Card } from "../../components/Card";
import { ColorPalette, spacing } from "../../theme/colors";
import { useColors } from "../../theme/ThemeContext";
import { createScreenStyles } from "../../theme/layout";
import { useSettingsStore } from "../../state/useSettingsStore";
import { TRUNK_ANDROID_REPO_URL } from "../../copy/links";
import { getSessionLog, formatSessionLog } from "../../services/sessionLog";

const ROWS: { route: string; label: string; hint: string }[] = [
  { route: "Diagnostics", label: "Test Suite", hint: "Run the on-device self-check suite and share the log." },
  { route: "Failure Log", label: "Failure Log", hint: "Every error the app has shown you, with timestamps." },
  { route: "Storage Inspector", label: "Storage Inspector", hint: "Browse and export the app's raw AsyncStorage data." },
];

/** A mainstream Settings section (no longer a hidden, tap-to-unlock
 * feature) - tools aimed at whoever is testing the app, not required for
 * regular use but not worth hiding either. */
export function DeveloperOptionsScreen({ navigation }: any) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const backendUrl = useSettingsStore((s) => s.backendUrl);

  const sendLogs = async () => {
    const entries = await getSessionLog();
    await Share.share({ message: formatSessionLog(entries) });
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Pressable onPress={sendLogs} style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}>
        <View style={styles.rowTextWrap}>
          <Text style={styles.rowLabel}>Send Logs</Text>
          <Text style={styles.rowHint}>
            Share everything logged on this device (errors, and usage events if Usage Logging is on) via your own
            share sheet — nothing is sent automatically.
          </Text>
        </View>
        <Text style={styles.rowCaret}>›</Text>
      </Pressable>

      {ROWS.map((row) => (
        <Pressable
          key={row.route}
          onPress={() => navigation.navigate(row.route)}
          style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
        >
          <View style={styles.rowTextWrap}>
            <Text style={styles.rowLabel}>{row.label}</Text>
            <Text style={styles.rowHint}>{row.hint}</Text>
          </View>
          <Text style={styles.rowCaret}>›</Text>
        </Pressable>
      ))}

      <Pressable
        onPress={() => Linking.openURL(TRUNK_ANDROID_REPO_URL)}
        style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
      >
        <View style={styles.rowTextWrap}>
          <Text style={styles.rowLabel}>Source Repo</Text>
          <Text style={styles.rowHint}>{TRUNK_ANDROID_REPO_URL}</Text>
        </View>
        <Text style={styles.rowCaret}>›</Text>
      </Pressable>

      <Card>
        <Text style={styles.rowLabel}>Backend</Text>
        <Text style={styles.debugLine} selectable>
          {backendUrl}
        </Text>
      </Card>
    </ScrollView>
  );
}

function createStyles(colors: ColorPalette) {
  const screen = createScreenStyles(colors);
  return StyleSheet.create({
    container: screen.container,
    content: { padding: spacing.md },
    row: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      padding: spacing.md,
      marginBottom: spacing.sm,
    },
    rowPressed: { backgroundColor: colors.surfaceAlt },
    rowTextWrap: { flex: 1, marginRight: spacing.sm },
    rowLabel: { color: colors.textPrimary, fontSize: 15, fontWeight: "600", marginBottom: 2 },
    rowHint: { color: colors.textSecondary, fontSize: 12 },
    rowCaret: { color: colors.textSecondary, fontSize: 22, fontWeight: "700" },
    debugLine: { color: colors.textSecondary, fontSize: 11, fontFamily: "monospace", marginTop: spacing.xs },
  });
}
