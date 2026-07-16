import React, { useMemo, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Text } from "./Text";
import { TextInput } from "./TextInput";
import { Button } from "./Button";
import { GradientSlider } from "./GradientSlider";
import { ACCENT_PRESETS, ColorPalette, DEFAULT_ACCENT_PRESET, isValidHexColor, spacing } from "../theme/colors";
import { useColors, useThemeScheme } from "../theme/ThemeContext";
import { useSettingsStore, ThemeMode, DarkContrast } from "../state/useSettingsStore";
import { buildGradientStops, hexToHsl, hslToHex } from "../utils/color";

const THEME_OPTIONS: { mode: ThemeMode; label: string }[] = [
  { mode: "light", label: "Light" },
  { mode: "dark", label: "Dark" },
  { mode: "system", label: "System" },
];

const DARK_CONTRAST_OPTIONS: { value: DarkContrast; label: string }[] = [
  { value: "standard", label: "Standard" },
  { value: "pitchBlack", label: "Pitch Black" },
];

/** Theme mode (Light/Dark/System) + the dark-only contrast sub-choice.
 * Shared between Settings and the first-launch onboarding setup step so
 * both look and behave identically. */
export function ThemeModeSection() {
  const colors = useColors();
  const scheme = useThemeScheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const themeMode = useSettingsStore((s) => s.themeMode);
  const setThemeMode = useSettingsStore((s) => s.setThemeMode);
  const darkContrast = useSettingsStore((s) => s.darkContrast);
  const setDarkContrast = useSettingsStore((s) => s.setDarkContrast);
  const secretTheme = useSettingsStore((s) => s.secretTheme);
  const setSecretTheme = useSettingsStore((s) => s.setSecretTheme);

  return (
    <>
      <View style={styles.themeRow}>
        {THEME_OPTIONS.map((opt) => {
          const active = secretTheme === "none" && opt.mode === themeMode;
          return (
            <Pressable
              key={opt.mode}
              onPress={() => {
                setSecretTheme("none");
                setThemeMode(opt.mode);
              }}
              style={[styles.themeChip, active && styles.themeChipActive]}
            >
              <Text style={[styles.themeChipLabel, active && styles.themeChipLabelActive]}>{opt.label}</Text>
            </Pressable>
          );
        })}
      </View>

      {scheme === "dark" ? (
        <>
          <Text style={styles.subLabel}>Dark contrast</Text>
          <View style={styles.themeRow}>
            {DARK_CONTRAST_OPTIONS.map((opt) => {
              const active = secretTheme === "none" && opt.value === darkContrast;
              return (
                <Pressable
                  key={opt.value}
                  onPress={() => {
                    setSecretTheme("none");
                    setDarkContrast(opt.value);
                  }}
                  style={[styles.themeChip, active && styles.themeChipActive]}
                >
                  <Text style={[styles.themeChipLabel, active && styles.themeChipLabelActive]}>{opt.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </>
      ) : null}
    </>
  );
}

type ColorFieldKey = "primary" | "secondary" | "tertiary";

function ColorField({
  label,
  placeholder,
  value,
  onChangeText,
  isOpen,
  onToggle,
  colors,
  styles,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChangeText: (v: string) => void;
  isOpen: boolean;
  onToggle: () => void;
  colors: ColorPalette;
  styles: ReturnType<typeof createStyles>;
}) {
  const previewColor = isValidHexColor(value) ? value.trim() : colors.border;
  const { h, s, l } = hexToHsl(isValidHexColor(value) ? value.trim() : placeholder);

  const setHsl = (next: { h: number; s: number; l: number }) => {
    onChangeText(hslToHex(next.h, next.s, next.l));
  };

  const hueStops = useMemo(() => buildGradientStops((t) => hslToHex(t * 360, 100, 50)), []);
  const satStops = useMemo(() => buildGradientStops((t) => hslToHex(h, t * 100, l)), [h, l]);
  const lightStops = useMemo(() => buildGradientStops((t) => hslToHex(h, s, t * 100)), [h, s]);

  return (
    <View style={styles.colorField}>
      <View style={styles.customRow}>
        <Text style={styles.customLabel}>{label}</Text>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.textSecondary}
          style={styles.input}
          autoCapitalize="none"
          maxLength={7}
        />
        <Pressable onPress={onToggle} hitSlop={8} style={[styles.previewSwatch, { backgroundColor: previewColor }]} />
      </View>
      {isOpen ? (
        <View style={styles.pickerPanel}>
          <View style={styles.sliderRow}>
            <Text style={styles.sliderLabel}>H</Text>
            <View style={styles.sliderTrackWrap}>
              <GradientSlider value={h / 360} onChange={(v) => setHsl({ h: v * 360, s, l })} stops={hueStops} />
            </View>
            <Text style={styles.sliderValue}>{Math.round(h)}{`\u00B0`}</Text>
          </View>
          <View style={styles.sliderRow}>
            <Text style={styles.sliderLabel}>S</Text>
            <View style={styles.sliderTrackWrap}>
              <GradientSlider value={s / 100} onChange={(v) => setHsl({ h, s: v * 100, l })} stops={satStops} />
            </View>
            <Text style={styles.sliderValue}>{Math.round(s)}%</Text>
          </View>
          <View style={styles.sliderRow}>
            <Text style={styles.sliderLabel}>L</Text>
            <View style={styles.sliderTrackWrap}>
              <GradientSlider value={l / 100} onChange={(v) => setHsl({ h, s, l: v * 100 })} stops={lightStops} />
            </View>
            <Text style={styles.sliderValue}>{Math.round(l)}%</Text>
          </View>
        </View>
      ) : null}
    </View>
  );
}

/** Color palette swatches (including the custom hex picker). Shared between
 * Settings and onboarding for the exact same look/behavior. */
export function ColorPaletteSection() {
  const colors = useColors();
  const scheme = useThemeScheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const accentPreset = useSettingsStore((s) => s.accentPreset);
  const setAccentPreset = useSettingsStore((s) => s.setAccentPreset);
  const secretTheme = useSettingsStore((s) => s.secretTheme);
  const setSecretTheme = useSettingsStore((s) => s.setSecretTheme);
  const customPrimaryColor = useSettingsStore((s) => s.customPrimaryColor);
  const customSecondaryColor = useSettingsStore((s) => s.customSecondaryColor);
  const customTertiaryColor = useSettingsStore((s) => s.customTertiaryColor);
  const setCustomColors = useSettingsStore((s) => s.setCustomColors);

  const [primaryInput, setPrimaryInput] = useState(customPrimaryColor);
  const [secondaryInput, setSecondaryInput] = useState(customSecondaryColor);
  const [tertiaryInput, setTertiaryInput] = useState(customTertiaryColor);
  const [showCustomInputs, setShowCustomInputs] = useState(accentPreset === "custom");
  const [openPicker, setOpenPicker] = useState<ColorFieldKey | null>(null);
  const togglePicker = (key: ColorFieldKey) => setOpenPicker((cur) => (cur === key ? null : key));

  const customInputsValid =
    isValidHexColor(primaryInput) && isValidHexColor(secondaryInput) && isValidHexColor(tertiaryInput);

  const applyCustomColors = () => {
    if (!customInputsValid) return;
    setSecretTheme("none");
    setCustomColors(primaryInput.trim(), secondaryInput.trim(), tertiaryInput.trim());
  };

  const clearCustomColors = () => {
    const ocean = ACCENT_PRESETS[0];
    setPrimaryInput(ocean.primary[scheme]);
    setSecondaryInput(ocean.secondary[scheme]);
    setTertiaryInput(ocean.tertiary[scheme]);
    setAccentPreset(DEFAULT_ACCENT_PRESET);
    setShowCustomInputs(false);
    setOpenPicker(null);
  };

  return (
    <>
      <Text style={styles.hint}>
        A coordinated three-tone palette used throughout the app — primary (buttons, selection), secondary (progress
        and highlights, including the Inference screen), and tertiary (lighter-touch accents).
      </Text>
      <View style={styles.swatchRow}>
        {ACCENT_PRESETS.map((preset) => {
          const active = secretTheme === "none" && accentPreset === preset.name;
          return (
            <Pressable
              key={preset.name}
              onPress={() => {
                setShowCustomInputs(false);
                setSecretTheme("none");
                setAccentPreset(preset.name);
              }}
              style={styles.swatchTile}
            >
              <View style={styles.ballCluster}>
                <View style={[styles.ball, { backgroundColor: preset.tertiary[scheme] }]} />
                <View style={[styles.ball, styles.ballOverlap, { backgroundColor: preset.secondary[scheme] }]} />
                <View style={[styles.ball, styles.ballOverlap, { backgroundColor: preset.primary[scheme] }]} />
                {active ? (
                  <View style={styles.checkBadge}>
                    <Text style={styles.checkBadgeLabel}>{`\u2713`}</Text>
                  </View>
                ) : null}
              </View>
              <Text style={styles.swatchName} numberOfLines={1}>
                {preset.name}
              </Text>
            </Pressable>
          );
        })}
        <Pressable onPress={() => setShowCustomInputs(true)} style={styles.swatchTile}>
          <View style={styles.ballCluster}>
            {accentPreset === "custom" ? (
              <>
                <View style={[styles.ball, { backgroundColor: customTertiaryColor }]} />
                <View style={[styles.ball, styles.ballOverlap, { backgroundColor: customSecondaryColor }]} />
                <View style={[styles.ball, styles.ballOverlap, { backgroundColor: customPrimaryColor }]} />
                {secretTheme === "none" ? (
                  <View style={styles.checkBadge}>
                    <Text style={styles.checkBadgeLabel}>{`\u2713`}</Text>
                  </View>
                ) : null}
              </>
            ) : (
              <View style={[styles.ball, styles.customBall]}>
                <Text style={styles.customSwatchLabel}>+</Text>
              </View>
            )}
          </View>
          <Text style={styles.swatchName}>Custom</Text>
        </Pressable>
      </View>

      {showCustomInputs ? (
        <View style={styles.customInputs}>
          <ColorField
            label="Primary"
            placeholder="#3D7CFF"
            value={primaryInput}
            onChangeText={setPrimaryInput}
            isOpen={openPicker === "primary"}
            onToggle={() => togglePicker("primary")}
            colors={colors}
            styles={styles}
          />
          <ColorField
            label="Secondary"
            placeholder="#22D3EE"
            value={secondaryInput}
            onChangeText={setSecondaryInput}
            isOpen={openPicker === "secondary"}
            onToggle={() => togglePicker("secondary")}
            colors={colors}
            styles={styles}
          />
          <ColorField
            label="Tertiary"
            placeholder="#818CF8"
            value={tertiaryInput}
            onChangeText={setTertiaryInput}
            isOpen={openPicker === "tertiary"}
            onToggle={() => togglePicker("tertiary")}
            colors={colors}
            styles={styles}
          />
          <View style={styles.customActionsRow}>
            <View style={styles.customActionButton}>
              <Button label="Clear" onPress={clearCustomColors} variant="danger" />
            </View>
            <View style={styles.customActionButton}>
              <Button label="Apply Palette" onPress={applyCustomColors} variant="secondary" />
            </View>
          </View>
          {!customInputsValid ? <Text style={styles.error}>Enter three valid hex colors, e.g. #3D7CFF</Text> : null}
        </View>
      ) : null}
    </>
  );
}

function createStyles(colors: ColorPalette) {
  return StyleSheet.create({
    subLabel: {
      color: colors.textSecondary,
      fontSize: 11,
      fontWeight: "700",
      textTransform: "uppercase",
      marginTop: spacing.md,
      marginBottom: spacing.xs,
    },
    hint: { color: colors.textSecondary, fontSize: 11, marginBottom: spacing.sm },
    themeRow: { flexDirection: "row", gap: spacing.sm },
    themeChip: {
      flex: 1,
      borderWidth: 1,
      borderColor: colors.border,
      paddingVertical: spacing.sm,
      alignItems: "center",
    },
    themeChipActive: { borderColor: colors.accent, backgroundColor: colors.accent + "22" },
    themeChipLabel: { color: colors.textSecondary, fontSize: 13, fontWeight: "600" },
    themeChipLabelActive: { color: colors.accent },
    swatchRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md },
    swatchTile: { alignItems: "center", width: 64 },
    ballCluster: { flexDirection: "row", height: 36, alignItems: "center", marginBottom: spacing.xs },
    ball: {
      width: 32,
      height: 32,
      borderRadius: 16,
      borderWidth: 2,
      borderColor: colors.surface,
    },
    ballOverlap: { marginLeft: -14 },
    customBall: {
      backgroundColor: colors.surfaceAlt,
      borderColor: colors.border,
      borderStyle: "dashed",
      alignItems: "center",
      justifyContent: "center",
    },
    customSwatchLabel: { color: colors.textSecondary, fontSize: 16, fontWeight: "700" },
    checkBadge: {
      position: "absolute",
      top: -4,
      right: -4,
      width: 18,
      height: 18,
      borderRadius: 9,
      backgroundColor: colors.textPrimary,
      alignItems: "center",
      justifyContent: "center",
    },
    checkBadgeLabel: { color: colors.background, fontSize: 11, fontWeight: "700" },
    swatchName: { color: colors.textSecondary, fontSize: 11, textAlign: "center" },
    customActionsRow: { flexDirection: "row", gap: spacing.sm },
    customActionButton: { flex: 1 },
    customInputs: {
      marginTop: spacing.md,
      gap: spacing.md,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.sm,
    },
    colorField: { gap: spacing.xs },
    customRow: { flexDirection: "row", gap: spacing.sm, alignItems: "center" },
    customLabel: { color: colors.textSecondary, fontSize: 12, width: 62 },
    error: { color: colors.error, fontSize: 11 },
    input: {
      flex: 1,
      borderWidth: 1,
      borderColor: colors.border,
      color: colors.textPrimary,
      backgroundColor: colors.surfaceAlt,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.sm,
      fontFamily: "monospace",
    },
    previewSwatch: {
      width: 32,
      height: 32,
      borderRadius: 16,
      borderWidth: 2,
      borderColor: colors.border,
    },
    pickerPanel: { gap: spacing.xs, paddingTop: spacing.xs },
    sliderRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
    sliderLabel: { color: colors.textSecondary, fontSize: 11, width: 12 },
    sliderTrackWrap: { flex: 1 },
    sliderValue: { color: colors.textSecondary, fontSize: 11, width: 34, textAlign: "right" },
  });
}
