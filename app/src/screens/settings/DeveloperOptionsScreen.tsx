import React, { useMemo } from "react";
import { Pressable, ScrollView, StyleSheet, Switch, View } from "react-native";
import { Text } from "../../components/Text";
import { Card } from "../../components/Card";
import { ColorPalette, spacing } from "../../theme/colors";
import { useColors } from "../../theme/ThemeContext";
import { createScreenStyles } from "../../theme/layout";
import { useSettingsStore } from "../../state/useSettingsStore";

const ROWS: { route: string; label: string; hint: string }[] = [
  { route: "Diagnostics", label: "Test Suite", hint: "Run the on-device self-check suite and share the log." },
  { route: "Failure Log", label: "Failure Log", hint: "Every error the app has shown you, with timestamps." },
  { route: "Storage Inspector", label: "Storage Inspector", hint: "Browse and export the app's raw AsyncStorage data." },
];

/** Unlocked via 14 taps on the app icon in About (see AboutSettingsScreen) -
 * a hub for tools aimed at whoever is testing the app, not end users. */
export function DeveloperOptionsScreen({ navigation }: any) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const developerModeUnlocked = useSettingsStore((s) => s.developerModeUnlocked);
  const setDeveloperModeUnlocked = useSettingsStore((s) => s.setDeveloperModeUnlocked);

  const turnOff = () => {
    setDeveloperModeUnlocked(false);
    navigation.goBack();
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Card>
        <View style={styles.toggleRow}>
          <View style={styles.rowTextWrap}>
            <Text style={styles.rowLabel}>Developer Options</Text>
            <Text style={styles.rowHint}>Turn off to hide this whole section again — find it the same way (14 taps in About) to bring it back.</Text>
          </View>
          <Switch
            value={developerModeUnlocked}
            onValueChange={(v) => (v ? undefined : turnOff())}
            trackColor={{ false: colors.border, true: colors.accent }}
            thumbColor={colors.textPrimary}
          />
        </View>
      </Card>

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
    toggleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.md },
    rowTextWrap: { flex: 1, marginRight: spacing.sm },
    rowLabel: { color: colors.textPrimary, fontSize: 15, fontWeight: "600", marginBottom: 2 },
    rowHint: { color: colors.textSecondary, fontSize: 12 },
    rowCaret: { color: colors.textSecondary, fontSize: 22, fontWeight: "700" },
  });
}
