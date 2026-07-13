import React, { useMemo, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Text } from "./Text";
import { useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { HelpModal } from "./HelpModal";
import { GuideStep, PageGuideModal } from "./PageGuideModal";
import { ColorPalette, spacing } from "../theme/colors";
import { useColors } from "../theme/ThemeContext";

interface ScreenHeaderProps {
  title: string;
  subtitle?: string;
  /** Only the five root tab screens show the info/settings shortcuts —
   * sub-screens already have a native back button + title. */
  showActions?: boolean;
  /** Page-specific walkthrough steps. When provided, the "i" summary button
   * is replaced with a "GUIDE" text link (matching SETTINGS' style) that
   * opens a Prev/Next/Close stepper instead — Home has no guideSteps, so it
   * keeps the original single-button, all-sections-at-once HelpModal. */
  guideSteps?: GuideStep[];
}

/** The one place every top-level screen's title row is defined, so header
 * spacing/typography can't drift screen-by-screen the way it did before.
 * A screen's own "+" action renders as its own AddTile row below this
 * header, not as a button in here — see AddTile.tsx. */
export function ScreenHeader({ title, subtitle, showActions, guideSteps }: ScreenHeaderProps) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const navigation = useNavigation<any>();
  const [helpVisible, setHelpVisible] = useState(false);
  const [guideVisible, setGuideVisible] = useState(false);

  return (
    <View style={[styles.row, { paddingTop: Math.max(spacing.md, insets.top) }]}>
      <View style={styles.titleWrap}>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      {showActions ? (
        <View style={styles.actions}>
          {guideSteps ? (
            <Pressable onPress={() => setGuideVisible(true)} hitSlop={12}>
              <Text style={styles.settingsLabel}>GUIDE</Text>
            </Pressable>
          ) : (
            <Pressable
              onPress={() => setHelpVisible(true)}
              hitSlop={12}
              style={({ pressed }) => [styles.infoButton, pressed && styles.infoButtonPressed]}
            >
              <Text style={styles.infoGlyph}>i</Text>
            </Pressable>
          )}
          <Pressable onPress={() => navigation.navigate("Settings")} hitSlop={12}>
            <Text style={styles.settingsLabel}>SETTINGS</Text>
          </Pressable>
          <HelpModal visible={helpVisible} onClose={() => setHelpVisible(false)} />
          {guideSteps ? (
            <PageGuideModal visible={guideVisible} onClose={() => setGuideVisible(false)} steps={guideSteps} />
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

function createStyles(colors: ColorPalette) {
  return StyleSheet.create({
    row: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      backgroundColor: colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      padding: spacing.md,
      paddingBottom: spacing.md,
      marginBottom: spacing.sm,
    },
    titleWrap: { flexShrink: 1, paddingRight: spacing.sm },
    title: { color: colors.textPrimary, fontSize: 26, fontWeight: "700" },
    subtitle: { color: colors.textSecondary, fontSize: 12, marginTop: spacing.xs },
    actions: { flexDirection: "row", alignItems: "center", gap: 18 },
    infoButton: {
      width: 18,
      height: 18,
      borderRadius: 9,
      borderWidth: 1.5,
      borderColor: colors.textSecondary,
      alignItems: "center",
      justifyContent: "center",
    },
    infoButtonPressed: { backgroundColor: colors.textSecondary + "22" },
    infoGlyph: { fontSize: 11, fontWeight: "700", color: colors.textSecondary },
    settingsLabel: { fontSize: 13, color: colors.textSecondary, fontWeight: "600" },
  });
}
