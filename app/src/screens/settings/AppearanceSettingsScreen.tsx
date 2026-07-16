import React, { useMemo } from "react";
import { Pressable, ScrollView, StyleSheet, Switch, View } from "react-native";
import { Text } from "../../components/Text";
import { Card } from "../../components/Card";
import { ThemeModeSection, ColorPaletteSection } from "../../components/AppearanceSettings";
import { ColorPalette, SecretThemeId, SECRET_THEMES, spacing } from "../../theme/colors";
import { useColors } from "../../theme/ThemeContext";
import { useSettingsStore } from "../../state/useSettingsStore";
import { wasSecretThemesUnlockedAtBoot } from "../../state/sessionFlags";
import { createScreenStyles } from "../../theme/layout";

export function AppearanceSettingsScreen() {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const useCustomFont = useSettingsStore((s) => s.useCustomFont);
  const setUseCustomFont = useSettingsStore((s) => s.setUseCustomFont);
  const secretThemesUnlocked = useSettingsStore((s) => s.secretThemesUnlocked);
  const setSecretThemesUnlocked = useSettingsStore((s) => s.setSecretThemesUnlocked);
  const secretTheme = useSettingsStore((s) => s.secretTheme);
  const setSecretTheme = useSettingsStore((s) => s.setSecretTheme);

  const turnOffSecretThemes = () => {
    setSecretTheme("none");
    setSecretThemesUnlocked(false);
  };

  // OR'd with the boot-time snapshot so turning the toggle off doesn't hide
  // the whole card mid-session — it still takes effect for the next launch
  // (see sessionFlags.ts). The Switch itself still reflects the live value.
  const showSecretThemesCard = secretThemesUnlocked || wasSecretThemesUnlockedAtBoot();

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Card>
        <Text style={styles.sectionTitle}>Appearance</Text>
        <ThemeModeSection />
      </Card>

      <Card>
        <Text style={styles.sectionTitle}>Typography</Text>
        <View style={styles.themeRow}>
          <Pressable
            onPress={() => setUseCustomFont(true)}
            style={[styles.themeChip, useCustomFont && styles.themeChipActive]}
          >
            <Text style={[styles.themeChipLabel, useCustomFont && styles.themeChipLabelActive]}>Urbanist</Text>
          </Pressable>
          <Pressable
            onPress={() => setUseCustomFont(false)}
            style={[styles.themeChip, !useCustomFont && styles.themeChipActive]}
          >
            <Text style={[styles.themeChipLabel, !useCustomFont && styles.themeChipLabelActive]}>Default</Text>
          </Pressable>
        </View>
      </Card>

      <Card>
        <Text style={styles.sectionTitle}>Color Palette</Text>
        <ColorPaletteSection />
      </Card>

      {showSecretThemesCard ? (
        <Card>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Secret Themes</Text>
            <Switch
              value={secretThemesUnlocked}
              onValueChange={(v) => (v ? undefined : turnOffSecretThemes())}
              trackColor={{ false: colors.border, true: colors.accent }}
              thumbColor={colors.textPrimary}
            />
          </View>
          <Text style={styles.hint}>
            Fully replaces the color system above - pick "None" to go back to normal. Turn this off to hide it again;
            find it the same way you found it (About) to bring it back.
          </Text>
          <View style={styles.themeRow}>
            {(Object.keys(SECRET_THEMES) as SecretThemeId[]).slice(0, 2).map((id) => {
              const active = secretTheme === id;
              return (
                <Pressable
                  key={id}
                  onPress={() => setSecretTheme(id)}
                  style={[styles.themeChip, active && styles.themeChipActive]}
                >
                  <Text style={[styles.themeChipLabel, active && styles.themeChipLabelActive]}>
                    {SECRET_THEMES[id].label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <View style={[styles.themeRow, styles.secretThemeRowGap]}>
            {(Object.keys(SECRET_THEMES) as SecretThemeId[]).slice(2).map((id) => {
              const active = secretTheme === id;
              return (
                <Pressable
                  key={id}
                  onPress={() => setSecretTheme(id)}
                  style={[styles.themeChip, active && styles.themeChipActive]}
                >
                  <Text style={[styles.themeChipLabel, active && styles.themeChipLabelActive]}>
                    {SECRET_THEMES[id].label}
                  </Text>
                </Pressable>
              );
            })}
            <Pressable
              onPress={() => setSecretTheme("none")}
              style={[styles.themeChip, secretTheme === "none" && styles.themeChipActive]}
            >
              <Text style={[styles.themeChipLabel, secretTheme === "none" && styles.themeChipLabelActive]}>None</Text>
            </Pressable>
          </View>
        </Card>
      ) : null}
    </ScrollView>
  );
}

function createStyles(colors: ColorPalette) {
  const screen = createScreenStyles(colors);
  return StyleSheet.create({
    container: screen.container,
    content: { padding: spacing.md },
    sectionTitle: { color: colors.textPrimary, fontSize: 14, fontWeight: "600", marginBottom: spacing.sm },
    sectionHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    hint: { color: colors.textSecondary, fontSize: 11, marginBottom: spacing.sm },
    themeRow: { flexDirection: "row", gap: spacing.sm },
    themeChip: { flex: 1, borderWidth: 1, borderColor: colors.border, paddingVertical: spacing.sm, alignItems: "center" },
    themeChipActive: { borderColor: colors.accent, backgroundColor: colors.accent + "22" },
    themeChipLabel: { color: colors.textSecondary, fontSize: 13, fontWeight: "600" },
    themeChipLabelActive: { color: colors.accent },
    secretThemeRowGap: { marginTop: spacing.sm },
  });
}
