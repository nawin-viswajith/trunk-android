import React, { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Switch, View } from "react-native";
import { Text } from "../../components/Text";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button } from "../../components/Button";
import { ThemeModeSection, ColorPaletteSection } from "../../components/AppearanceSettings";
import { ColorPalette, DEFAULT_ACCENT_PRESET, spacing } from "../../theme/colors";
import { useColors, useThemeScheme } from "../../theme/ThemeContext";
import { useSettingsStore } from "../../state/useSettingsStore";
import { PERFORMANCE_DISCLAIMER } from "../../copy/disclaimers";
import { detectNpuDevices } from "../../services/llamaEngine";

const SLIDES = [
  {
    title: "Welcome to Trunk",
    body: "Run large language models fully offline, entirely on your own device. No cloud, no server, no account required.",
  },
  {
    title: "Bring your own models",
    body: "Browse and download GGUF models straight from Hugging Face, or import ones you already have on your device.",
  },
  {
    title: "Projects & chat sessions",
    body: "Group a model with its own settings into a Project, then keep multiple chat sessions and history alongside it.",
  },
];

type Phase = "slides" | "warning" | "deviceWarning" | "setup";

export function OnboardingFlow() {
  const colors = useColors();
  const scheme = useThemeScheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [phase, setPhase] = useState<Phase>("slides");
  const [slideIndex, setSlideIndex] = useState(0);

  const accentPreset = useSettingsStore((s) => s.accentPreset);
  const setAccentPreset = useSettingsStore((s) => s.setAccentPreset);
  const showInferenceStats = useSettingsStore((s) => s.showInferenceStats);
  const setShowInferenceStats = useSettingsStore((s) => s.setShowInferenceStats);
  const npuAcceleration = useSettingsStore((s) => s.npuAcceleration);
  const setNpuAcceleration = useSettingsStore((s) => s.setNpuAcceleration);
  const setHasOnboarded = useSettingsStore((s) => s.setHasOnboarded);
  const [npuDevices, setNpuDevices] = useState<string[] | null>(null);

  useEffect(() => {
    if (phase !== "setup") return;
    let cancelled = false;
    detectNpuDevices().then((devices) => {
      if (!cancelled) setNpuDevices(devices);
    });
    return () => {
      cancelled = true;
    };
  }, [phase]);

  // Suggest a palette that matches the resolved scheme, but only until the
  // user actually picks one themselves (tracked by still being on the
  // untouched app default).
  useEffect(() => {
    if (accentPreset !== DEFAULT_ACCENT_PRESET) return;
    setAccentPreset(scheme === "light" ? "Sunset" : "Greyscale");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scheme]);

  const finish = () => setHasOnboarded(true);

  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing.lg, paddingBottom: insets.bottom + spacing.lg }]}>
      {phase === "slides" ? (
        <>
          <View style={styles.body}>
            <Text style={styles.title}>{SLIDES[slideIndex].title}</Text>
            <Text style={styles.text}>{SLIDES[slideIndex].body}</Text>
          </View>
          <View style={styles.dotsRow}>
            {SLIDES.map((_, i) => (
              <View key={i} style={[styles.dot, i === slideIndex && styles.dotActive]} />
            ))}
          </View>
          <View style={styles.footerRow}>
            <Pressable onPress={() => setPhase("warning")} hitSlop={12}>
              <Text style={styles.skipLabel}>Skip</Text>
            </Pressable>
            <View style={styles.nextButton}>
              <Button
                label="Next"
                variant="primary"
                onPress={() => {
                  if (slideIndex < SLIDES.length - 1) setSlideIndex(slideIndex + 1);
                  else setPhase("warning");
                }}
              />
            </View>
          </View>
        </>
      ) : null}

      {phase === "warning" ? (
        <>
          <View style={styles.body}>
            <Text style={styles.warningTitle}>⚠ Before you start</Text>
            <Text style={styles.text}>
              Your chats and projects are stored only on this device - nothing is synced to an account or backed up
              anywhere.
            </Text>
            <Text style={styles.warningEmphasis}>
              If you uninstall the app or lose this device, your chat history cannot be recovered under any
              circumstances.
            </Text>
          </View>
          <View style={styles.footerSingle}>
            <Button label="I Understand, Continue" variant="primary" onPress={() => setPhase("deviceWarning")} />
          </View>
        </>
      ) : null}

      {phase === "deviceWarning" ? (
        <>
          <View style={styles.body}>
            <Text style={styles.warningTitle}>⚠ {PERFORMANCE_DISCLAIMER.title}</Text>
            <Text style={styles.text}>{PERFORMANCE_DISCLAIMER.body}</Text>
            <Text style={styles.warningEmphasis}>{PERFORMANCE_DISCLAIMER.emphasis}</Text>
          </View>
          <View style={styles.footerSingle}>
            <Button label="I Understand, Continue" variant="primary" onPress={() => setPhase("setup")} />
          </View>
        </>
      ) : null}

      {phase === "setup" ? (
        <>
          <ScrollView style={styles.scrollBody} contentContainerStyle={styles.scrollBodyContent}>
            <Text style={styles.title}>Set up your experience</Text>
            <Text style={styles.text}>Pick a look to start with - you can change this anytime in Settings.</Text>

            <Text style={styles.sectionTitle}>Appearance</Text>
            <ThemeModeSection />

            <Text style={[styles.sectionTitle, styles.sectionTitleSpaced]}>Color Palette</Text>
            <ColorPaletteSection />

            <View style={styles.toggleRow}>
              <View style={styles.toggleTextWrap}>
                <Text style={styles.toggleLabel}>Show response stats</Text>
                <Text style={styles.toggleHint}>Input/output tok/s and time taken, shown under each reply.</Text>
              </View>
              <Switch
                value={showInferenceStats}
                onValueChange={setShowInferenceStats}
                trackColor={{ false: colors.border, true: colors.accent }}
                thumbColor={colors.textPrimary}
              />
            </View>

            <Text style={[styles.sectionTitle, styles.sectionTitleSpaced]}>Inference Unit</Text>
            <Text style={styles.text}>
              {npuDevices === null
                ? "Checking this device's chipset…"
                : npuDevices.length > 0
                  ? "A supported Hexagon NPU was found on this device — inference can run on it instead of the CPU."
                  : "No supported Hexagon NPU was found on this device (Qualcomm Snapdragon 8 Gen 1 or newer only) — inference will run on CPU either way."}
            </Text>
            <View style={styles.toggleRow}>
              <View style={styles.toggleTextWrap}>
                <Text style={styles.toggleLabel}>Use NPU when available</Text>
                <Text style={styles.toggleHint}>Experimental. Best suited to models under 4B parameters.</Text>
              </View>
              <Switch
                value={npuAcceleration}
                onValueChange={setNpuAcceleration}
                disabled={npuDevices !== null && npuDevices.length === 0}
                trackColor={{ false: colors.border, true: colors.accent }}
                thumbColor={colors.textPrimary}
              />
            </View>
          </ScrollView>
          <View style={styles.footerSingle}>
            <Button label="Get Started" variant="primary" onPress={finish} />
          </View>
        </>
      ) : null}
    </View>
  );
}

function createStyles(colors: ColorPalette) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background, paddingHorizontal: spacing.lg, justifyContent: "space-between" },
    body: { flex: 1, justifyContent: "center", gap: spacing.md },
    scrollBody: { flex: 1 },
    scrollBodyContent: { gap: spacing.md, paddingBottom: spacing.lg },
    title: { color: colors.textPrimary, fontSize: 26, fontWeight: "700" },
    text: { color: colors.textSecondary, fontSize: 15, lineHeight: 22, textAlign: "justify" },
    warningTitle: { color: colors.error, fontSize: 26, fontWeight: "700" },
    warningEmphasis: { color: colors.error, fontSize: 15, lineHeight: 22, fontWeight: "700", textAlign: "justify" },
    dotsRow: { flexDirection: "row", justifyContent: "center", gap: spacing.xs, marginBottom: spacing.lg },
    dot: { width: 8, height: 8, backgroundColor: colors.border },
    dotActive: { backgroundColor: colors.accent },
    footerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    footerSingle: { alignItems: "stretch" },
    skipLabel: { color: colors.textSecondary, fontSize: 15, fontWeight: "600" },
    nextButton: { minWidth: 120 },
    sectionTitle: { color: colors.textPrimary, fontSize: 14, fontWeight: "600" },
    sectionTitleSpaced: { marginTop: spacing.sm },
    toggleRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: spacing.md,
      marginTop: spacing.sm,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      padding: spacing.md,
    },
    toggleTextWrap: { flex: 1 },
    toggleLabel: { color: colors.textPrimary, fontSize: 14, fontWeight: "600", marginBottom: 2 },
    toggleHint: { color: colors.textSecondary, fontSize: 11, textAlign: "justify" },
  });
}
