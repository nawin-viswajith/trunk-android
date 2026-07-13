import React, { useMemo } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Text } from "../../components/Text";
import { ColorPalette, spacing } from "../../theme/colors";
import { useColors } from "../../theme/ThemeContext";
import { createScreenStyles } from "../../theme/layout";
import { useSettingsStore } from "../../state/useSettingsStore";
import { wasDeveloperModeUnlockedAtBoot } from "../../state/sessionFlags";

const CATEGORIES: { route: string; label: string; hint: string }[] = [
  { route: "Appearance Settings", label: "Appearance", hint: "Light/dark theme, font, and accent color." },
  { route: "Chat & Downloads Settings", label: "Chat & Downloads", hint: "Response stats, and mobile data vs. Wi-Fi." },
  { route: "Performance Settings", label: "Performance", hint: "Lite Mode, and keeping Trunk running in the background." },
  { route: "About Settings", label: "About", hint: "What Trunk is, and its license." },
];

const DEVELOPER_CATEGORY = {
  route: "Developer Options",
  label: "Developer Options",
  hint: "Test suite, failure log, and storage inspector.",
};

export function SettingsListScreen({ navigation }: any) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const developerModeUnlocked = useSettingsStore((s) => s.developerModeUnlocked);
  // OR'd with the boot-time snapshot so turning the toggle off doesn't yank
  // the row out from under the user mid-session — it still takes effect
  // for the next launch (see sessionFlags.ts).
  const showDeveloperOptions = developerModeUnlocked || wasDeveloperModeUnlockedAtBoot();
  const categories = showDeveloperOptions ? [...CATEGORIES, DEVELOPER_CATEGORY] : CATEGORIES;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {categories.map((category) => (
        <Pressable
          key={category.route}
          onPress={() => navigation.navigate(category.route)}
          style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
        >
          <View style={styles.rowTextWrap}>
            <Text style={styles.rowLabel}>{category.label}</Text>
            <Text style={styles.rowHint}>{category.hint}</Text>
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
    rowTextWrap: { flex: 1, marginRight: spacing.sm },
    rowLabel: { color: colors.textPrimary, fontSize: 15, fontWeight: "600", marginBottom: 2 },
    rowHint: { color: colors.textSecondary, fontSize: 12 },
    rowCaret: { color: colors.textSecondary, fontSize: 22, fontWeight: "700" },
  });
}
