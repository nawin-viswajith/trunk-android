import React, { createContext, useContext, useMemo } from "react";
import { useColorScheme } from "react-native";
import { useSettingsStore } from "../state/useSettingsStore";
import { ACCENT_PRESETS, ColorPalette, darkBase, darkBasePitchBlack, lightBase, SECRET_THEMES } from "./colors";

interface ThemeContextValue {
  scheme: "light" | "dark";
  colors: ColorPalette;
}

const ThemeContext = createContext<ThemeContextValue>({
  scheme: "dark",
  colors: { ...darkBase, accent: "#3D7CFF", accentSecondary: "#22D3EE", accentTertiary: "#818CF8" },
});

function resolveAccents(
  accentPreset: string,
  customPrimaryColor: string,
  customSecondaryColor: string,
  customTertiaryColor: string,
  scheme: "light" | "dark"
): { accent: string; accentSecondary: string; accentTertiary: string } {
  if (accentPreset === "custom") {
    return { accent: customPrimaryColor, accentSecondary: customSecondaryColor, accentTertiary: customTertiaryColor };
  }
  const preset = ACCENT_PRESETS.find((p) => p.name === accentPreset) ?? ACCENT_PRESETS[0];
  return {
    accent: preset.primary[scheme],
    accentSecondary: preset.secondary[scheme],
    accentTertiary: preset.tertiary[scheme],
  };
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const themeMode = useSettingsStore((s) => s.themeMode);
  const darkContrast = useSettingsStore((s) => s.darkContrast);
  const accentPreset = useSettingsStore((s) => s.accentPreset);
  const customPrimaryColor = useSettingsStore((s) => s.customPrimaryColor);
  const customSecondaryColor = useSettingsStore((s) => s.customSecondaryColor);
  const customTertiaryColor = useSettingsStore((s) => s.customTertiaryColor);
  const secretTheme = useSettingsStore((s) => s.secretTheme);
  const systemScheme = useColorScheme();

  const value = useMemo<ThemeContextValue>(() => {
    const scheme = themeMode === "system" ? (systemScheme === "light" ? "light" : "dark") : themeMode;
    // A secret theme fully replaces the normal resolution below - it isn't
    // an accent layered on top of light/dark, it's one fixed look regardless
    // of what light/dark mode was previously selected.
    if (secretTheme !== "none") {
      const { label, ...colors } = SECRET_THEMES[secretTheme];
      return { scheme, colors };
    }
    const base = scheme === "light" ? lightBase : darkContrast === "pitchBlack" ? darkBasePitchBlack : darkBase;
    const accents = resolveAccents(accentPreset, customPrimaryColor, customSecondaryColor, customTertiaryColor, scheme);
    return { scheme, colors: { ...base, ...accents } };
  }, [
    themeMode,
    darkContrast,
    accentPreset,
    customPrimaryColor,
    customSecondaryColor,
    customTertiaryColor,
    secretTheme,
    systemScheme,
  ]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useColors(): ColorPalette {
  return useContext(ThemeContext).colors;
}

export function useThemeScheme(): "light" | "dark" {
  return useContext(ThemeContext).scheme;
}
