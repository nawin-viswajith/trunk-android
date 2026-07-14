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
import { FEEDBACK_FORM_URL, TUSKERLABS_WEBSITE_URL, TRUNK_PRODUCT_URL } from "../../copy/links";
import { RELEASE_NOTES } from "../../copy/releaseNotes";
import appJson from "../../../app.json";

const APP_VERSION: string = appJson.expo.version;

const SECRET_THEME_TAPS_TO_UNLOCK = 7;
const SECRET_THEME_TAP_RESET_MS = 1200;

export function AboutSettingsScreen({ navigation }: any) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const secretThemesUnlocked = useSettingsStore((s) => s.secretThemesUnlocked);
  const unlockSecretThemes = useSettingsStore((s) => s.unlockSecretThemes);
  const [licenseVisible, setLicenseVisible] = useState(false);
  const [releaseNotesVisible, setReleaseNotesVisible] = useState(false);

  const tapCountRef = useRef(0);
  const lastTapRef = useRef(0);
  const [countdownMessage, setCountdownMessage] = useState<string | null>(null);
  const clearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // The countdown line mirrors Android's own "tap build number" toast:
  // silent for the first couple taps, then a running "N taps away" hint.
  const onTapIcon = () => {
    const now = Date.now();
    tapCountRef.current = now - lastTapRef.current > SECRET_THEME_TAP_RESET_MS ? 1 : tapCountRef.current + 1;
    lastTapRef.current = now;
    const count = tapCountRef.current;

    let message: string | null = null;
    if (!secretThemesUnlocked && count >= 3 && count < SECRET_THEME_TAPS_TO_UNLOCK) {
      const remaining = SECRET_THEME_TAPS_TO_UNLOCK - count;
      message = `${remaining} more tap${remaining === 1 ? "" : "s"} to unlock Secret Themes`;
    }
    setCountdownMessage(message);
    if (clearTimerRef.current) clearTimeout(clearTimerRef.current);
    if (message) clearTimerRef.current = setTimeout(() => setCountdownMessage(null), SECRET_THEME_TAP_RESET_MS);

    if (!secretThemesUnlocked && count >= SECRET_THEME_TAPS_TO_UNLOCK) {
      tapCountRef.current = 0;
      unlockSecretThemes();
      setCountdownMessage(null);
      showAlert("You found something", "Secret Themes unlocked — find them under Settings > Appearance.", [
        { label: "Nice" },
      ]);
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
            <Text style={styles.identity}>Version {APP_VERSION}</Text>
          </View>
        </View>
        <Text style={styles.shortDescription}>
          No cloud, no server, no account - chat with GGUF models, bind them to Projects, or chain reusable Agents
          into Flows, fully offline.
        </Text>
        {countdownMessage ? <Text style={styles.countdown}>{countdownMessage}</Text> : null}
      </Card>

      <Pressable
        onPress={() => Linking.openURL(TUSKERLABS_WEBSITE_URL)}
        style={({ pressed }) => [styles.licenseTile, pressed && styles.licenseTilePressed]}
      >
        <View style={styles.tileTextWrap}>
          <Text style={styles.licenseTileLabel}>TuskerLabs</Text>
          <Text style={styles.tileHint}>The team behind Trunk</Text>
        </View>
        <Text style={styles.licenseTileCaret}>›</Text>
      </Pressable>

      <Pressable
        onPress={() => Linking.openURL(TRUNK_PRODUCT_URL)}
        style={({ pressed }) => [styles.licenseTile, pressed && styles.licenseTilePressed]}
      >
        <View style={styles.tileTextWrap}>
          <Text style={styles.licenseTileLabel}>Trunk</Text>
          <Text style={styles.tileHint}>Product site, docs, and release notes</Text>
        </View>
        <Text style={styles.licenseTileCaret}>›</Text>
      </Pressable>

      <Pressable
        onPress={() => setReleaseNotesVisible(true)}
        style={({ pressed }) => [styles.licenseTile, pressed && styles.licenseTilePressed]}
      >
        <View style={styles.tileTextWrap}>
          <Text style={styles.licenseTileLabel}>Release Notes</Text>
          <Text style={styles.tileHint}>What's changed, version by version</Text>
        </View>
        <Text style={styles.licenseTileCaret}>›</Text>
      </Pressable>

      <Pressable
        onPress={() => Linking.openURL(FEEDBACK_FORM_URL)}
        style={({ pressed }) => [styles.licenseTile, pressed && styles.licenseTilePressed]}
      >
        <View style={styles.tileTextWrap}>
          <Text style={styles.licenseTileLabel}>Give Feedback</Text>
          <Text style={styles.tileHint}>Short form - tell us what's working and what isn't</Text>
        </View>
        <Text style={styles.licenseTileCaret}>›</Text>
      </Pressable>

      <Pressable
        onPress={() => setLicenseVisible(true)}
        style={({ pressed }) => [styles.licenseTile, pressed && styles.licenseTilePressed]}
      >
        <Text style={styles.licenseTileLabel}>License</Text>
        <Text style={styles.licenseTileCaret}>›</Text>
      </Pressable>

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

      <Modal
        visible={releaseNotesVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setReleaseNotesVisible(false)}
      >
        <Pressable style={styles.backdrop} onPress={() => setReleaseNotesVisible(false)}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            <Text style={styles.modalTitle}>Release Notes</Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              {RELEASE_NOTES.map((note) => (
                <View key={note.version} style={styles.releaseNoteRow}>
                  <Text style={styles.releaseNoteVersion}>
                    v{note.version}
                    {note.version === APP_VERSION ? " (this version)" : ""}
                  </Text>
                  <Text style={styles.releaseNoteSummary}>{note.summary}</Text>
                </View>
              ))}
            </ScrollView>
            <View style={styles.buttonRow}>
              <Button label="Close" onPress={() => setReleaseNotesVisible(false)} variant="secondary" />
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
    shortDescription: { color: colors.textSecondary, fontSize: 11, lineHeight: 16 },
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
    releaseNoteRow: { marginBottom: spacing.md },
    releaseNoteVersion: { color: colors.textPrimary, fontSize: 13, fontWeight: "700", marginBottom: 2 },
    releaseNoteSummary: { color: colors.textSecondary, fontSize: 12, lineHeight: 17 },
  });
}
