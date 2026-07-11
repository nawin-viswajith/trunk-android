import React, { useMemo } from "react";
import { Image, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { Card } from "../components/Card";
import { ThemeModeSection, ColorPaletteSection } from "../components/AppearanceSettings";
import { ColorPalette, spacing } from "../theme/colors";
import { useColors } from "../theme/ThemeContext";
import { useSettingsStore } from "../state/useSettingsStore";

export function SettingsScreen() {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const showInferenceStats = useSettingsStore((s) => s.showInferenceStats);
  const setShowInferenceStats = useSettingsStore((s) => s.setShowInferenceStats);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Card>
        <Text style={styles.sectionTitle}>Appearance</Text>
        <ThemeModeSection />
      </Card>

      <Card>
        <Text style={styles.sectionTitle}>Chat</Text>
        <View style={styles.toggleRow}>
          <View style={styles.toggleTextWrap}>
            <Text style={styles.toggleLabel}>Show response stats</Text>
            <Text style={styles.hint}>Input/output tok/s and time taken, shown under each reply.</Text>
          </View>
          <Switch
            value={showInferenceStats}
            onValueChange={setShowInferenceStats}
            trackColor={{ false: colors.border, true: colors.accent }}
            thumbColor={colors.surface}
          />
        </View>
      </Card>

      <Card>
        <Text style={styles.sectionTitle}>Color Palette</Text>
        <ColorPaletteSection />
      </Card>

      <Card>
        <Text style={styles.sectionTitle}>About</Text>
        <View style={styles.aboutRow}>
          <Image source={require("../../assets/icon.png")} style={styles.aboutLogo} resizeMode="contain" />
          <View style={styles.aboutTextWrap}>
            <Text style={styles.hint}>Trunk is a proprietary product built by TuskerLabs.</Text>
            <Text style={styles.hint}>© 2026 TuskerLabs. All rights reserved.</Text>
          </View>
        </View>
      </Card>
    </ScrollView>
  );
}

function createStyles(colors: ColorPalette) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    content: { padding: spacing.md },
    sectionTitle: { color: colors.textPrimary, fontSize: 14, fontWeight: "600", marginBottom: spacing.sm },
    hint: { color: colors.textSecondary, fontSize: 11, marginBottom: spacing.sm, textAlign: "justify" },
    toggleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.md },
    toggleTextWrap: { flex: 1 },
    toggleLabel: { color: colors.textPrimary, fontSize: 13, fontWeight: "600", marginBottom: 2 },
    aboutRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
    aboutLogo: { width: 44, height: 44 },
    aboutTextWrap: { flex: 1 },
  });
}
