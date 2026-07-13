import React, { useMemo, useRef, useState } from "react";
import { Image, Linking, Modal, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Text } from "../../components/Text";
import { Button } from "../../components/Button";
import { Card } from "../../components/Card";
import { ColorPalette, spacing } from "../../theme/colors";
import { useColors } from "../../theme/ThemeContext";
import { useSettingsStore } from "../../state/useSettingsStore";
import { showAlert } from "../../state/useAlertStore";
import { createScreenStyles } from "../../theme/layout";

const SECRET_THEME_TAPS_TO_UNLOCK = 7;
const DEVELOPER_MODE_TAPS_TO_UNLOCK = 14;
const SECRET_THEME_TAP_RESET_MS = 1200;

// TODO: placeholder until the real TuskerLabs/Trunk marketing site URL is
// confirmed - not guessed, since a wrong link here is worse than no link.
const TUSKERLABS_WEBSITE_URL = "https://tuskerlabs.dev";
const TRUNK_PRODUCT_URL = "https://tuskerlabs.dev/trunk";

export function AboutSettingsScreen({ navigation }: any) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const secretThemesUnlocked = useSettingsStore((s) => s.secretThemesUnlocked);
  const unlockSecretThemes = useSettingsStore((s) => s.unlockSecretThemes);
  const developerModeUnlocked = useSettingsStore((s) => s.developerModeUnlocked);
  const unlockDeveloperMode = useSettingsStore((s) => s.unlockDeveloperMode);
  const backendUrl = useSettingsStore((s) => s.backendUrl);
  const [licenseVisible, setLicenseVisible] = useState(false);

  const tapCountRef = useRef(0);
  const lastTapRef = useRef(0);
  const [countdownMessage, setCountdownMessage] = useState<string | null>(null);
  const clearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // A single counter, not two separate ones: tapping straight through to 14
  // passes 7 on the way, unlocking both in one continuous burst, while
  // tapping exactly 7 times and pausing only unlocks Secret Themes — same
  // "keep going for more" easter-egg convention as Android's own "tap build
  // number" developer-options unlock. The countdown line mirrors Android's
  // own toast too: silent for the first few taps, then a running "N taps
  // away" hint kicks in partway through each threshold.
  const onTapIcon = () => {
    const now = Date.now();
    tapCountRef.current = now - lastTapRef.current > SECRET_THEME_TAP_RESET_MS ? 1 : tapCountRef.current + 1;
    lastTapRef.current = now;
    const count = tapCountRef.current;

    let message: string | null = null;
    if (!secretThemesUnlocked && count >= 3 && count < SECRET_THEME_TAPS_TO_UNLOCK) {
      const remaining = SECRET_THEME_TAPS_TO_UNLOCK - count;
      message = `${remaining} more tap${remaining === 1 ? "" : "s"} to unlock Secret Themes`;
    } else if (!developerModeUnlocked && count >= 8 && count < DEVELOPER_MODE_TAPS_TO_UNLOCK) {
      const remaining = DEVELOPER_MODE_TAPS_TO_UNLOCK - count;
      message = `${remaining} more tap${remaining === 1 ? "" : "s"} to unlock Developer Options`;
    }
    setCountdownMessage(message);
    if (clearTimerRef.current) clearTimeout(clearTimerRef.current);
    if (message) clearTimerRef.current = setTimeout(() => setCountdownMessage(null), SECRET_THEME_TAP_RESET_MS);

    if (!secretThemesUnlocked && count >= SECRET_THEME_TAPS_TO_UNLOCK) {
      unlockSecretThemes();
      setCountdownMessage(null);
      showAlert("You found something", "Secret Themes unlocked — find them under Settings > Appearance.", [
        { label: "Nice" },
      ]);
    }
    if (!developerModeUnlocked && count >= DEVELOPER_MODE_TAPS_TO_UNLOCK) {
      tapCountRef.current = 0;
      setCountdownMessage(null);
      unlockDeveloperMode();
      showAlert("Developer Options unlocked", "Find them at the bottom of Settings.", [{ label: "Nice" }]);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Card>
        <View style={styles.heroRow}>
          <Pressable onPress={onTapIcon} hitSlop={8}>
            <Image source={require("../../../assets/icon.png")} style={styles.heroLogo} resizeMode="contain" />
          </Pressable>
          <View style={styles.heroTextWrap}>
            <Text style={styles.tagline}>Local inference engine for LLMs on your phone.</Text>
            <Text style={styles.identity}>© 2026 TuskerLabs · MIT License</Text>
          </View>
        </View>
        <Text style={styles.shortDescription}>
          Chat with GGUF models, bind them to Projects, or chain reusable Agents into Flows, fully offline.
        </Text>
        {countdownMessage ? <Text style={styles.countdown}>{countdownMessage}</Text> : null}
        {secretThemesUnlocked ? (
          <Text style={styles.debugLine} selectable>
            Backend: {backendUrl}
          </Text>
        ) : null}
      </Card>

      <Pressable
        onPress={() => Linking.openURL(TUSKERLABS_WEBSITE_URL)}
        style={({ pressed }) => [styles.licenseTile, pressed && styles.licenseTilePressed]}
      >
        <View style={styles.tileTextWrap}>
          <Text style={styles.licenseTileLabel}>TuskerLabs</Text>
          <Text style={styles.tileHint}>The team behind Trunk</Text>
        </View>
        <Text style={styles.tileWebIcon}>🌐</Text>
      </Pressable>

      <Pressable
        onPress={() => Linking.openURL(TRUNK_PRODUCT_URL)}
        style={({ pressed }) => [styles.licenseTile, pressed && styles.licenseTilePressed]}
      >
        <View style={styles.tileTextWrap}>
          <Text style={styles.licenseTileLabel}>Trunk</Text>
          <Text style={styles.tileHint}>Product site, docs, and release notes</Text>
        </View>
        <Text style={styles.tileWebIcon}>🌐</Text>
      </Pressable>

      <Pressable
        onPress={() => setLicenseVisible(true)}
        style={({ pressed }) => [styles.licenseTile, pressed && styles.licenseTilePressed]}
      >
        <Text style={styles.licenseTileLabel}>License</Text>
        <Text style={styles.licenseTileCaret}>›</Text>
      </Pressable>

      {developerModeUnlocked ? (
        <Pressable
          onPress={() => navigation.navigate("Developer Options")}
          style={({ pressed }) => [styles.licenseTile, pressed && styles.licenseTilePressed]}
        >
          <Text style={styles.licenseTileLabel}>Developer Options</Text>
          <Text style={styles.licenseTileCaret}>›</Text>
        </Pressable>
      ) : null}

      {/* TODO (see ROADMAP.md): a "Developer" tile — contact/GitHub/feedback
          link for the person(s) behind Trunk. Not wired up yet, commented
          out until there's real content to show here.
      <Pressable
        onPress={() => {}}
        style={({ pressed }) => [styles.licenseTile, pressed && styles.licenseTilePressed]}
      >
        <Text style={styles.licenseTileLabel}>Developer</Text>
        <Text style={styles.licenseTileCaret}>›</Text>
      </Pressable>
      */}

      <Modal visible={licenseVisible} transparent animationType="fade" onRequestClose={() => setLicenseVisible(false)}>
        <Pressable style={styles.backdrop} onPress={() => setLicenseVisible(false)}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            <Text style={styles.modalTitle}>MIT License</Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.licenseText}>{MIT_LICENSE_TEXT}</Text>
            </ScrollView>
            <View style={styles.buttonRow}>
              <Button label="Close" onPress={() => setLicenseVisible(false)} variant="secondary" />
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </ScrollView>
  );
}

const MIT_LICENSE_TEXT = `Copyright (c) 2026 TuskerLabs

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.`;

function createStyles(colors: ColorPalette) {
  const screen = createScreenStyles(colors);
  return StyleSheet.create({
    container: screen.container,
    content: { padding: spacing.md },
    heroRow: { flexDirection: "row", gap: spacing.md, alignItems: "center", marginBottom: spacing.sm },
    heroLogo: { width: 72, height: 72 },
    heroTextWrap: { flex: 1, gap: spacing.xs },
    tagline: { color: colors.textPrimary, fontSize: 14, fontWeight: "700" },
    identity: { color: colors.textSecondary, fontSize: 11 },
    shortDescription: { color: colors.textSecondary, fontSize: 11, lineHeight: 16, textAlign: "justify" },
    debugLine: { color: colors.textSecondary, fontSize: 10, fontFamily: "monospace", marginTop: spacing.sm },
    countdown: { color: colors.accent, fontSize: 11, fontWeight: "600", marginTop: spacing.xs },
    licenseTile: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      padding: spacing.md,
      marginTop: spacing.sm,
    },
    licenseTilePressed: { backgroundColor: colors.surfaceAlt },
    licenseTileLabel: { color: colors.textPrimary, fontSize: 14, fontWeight: "600" },
    licenseTileCaret: { color: colors.textSecondary, fontSize: 22, fontWeight: "700" },
    tileTextWrap: { flex: 1, marginRight: spacing.sm },
    tileHint: { color: colors.textSecondary, fontSize: 11, marginTop: 2 },
    tileWebIcon: { fontSize: 18 },
    backdrop: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.6)",
      justifyContent: "center",
      padding: spacing.lg,
    },
    modalCard: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderTopWidth: 3,
      borderTopColor: colors.accent,
      padding: spacing.lg,
      maxHeight: "80%",
    },
    modalTitle: { color: colors.textPrimary, fontSize: 18, fontWeight: "700", marginBottom: spacing.md },
    licenseText: { color: colors.textSecondary, fontSize: 11, lineHeight: 17, fontFamily: "monospace" },
    buttonRow: { marginTop: spacing.md },
  });
}
