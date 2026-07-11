import React, { createContext, useContext, useMemo } from "react";
import { useColorScheme } from "react-native";
import { useSettingsStore } from "../state/useSettingsStore";
import { ColorPalette, darkColors, lightColors } from "./colors";

interface ThemeContextValue {
  scheme: "light" | "dark";
  colors: ColorPalette;
}

const ThemeContext = createContext<ThemeContextValue>({ scheme: "dark", colors: darkColors });

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const themeMode = useSettingsStore((s) => s.themeMode);
  const systemScheme = useColorScheme();

  const value = useMemo<ThemeContextValue>(() => {
    const scheme = themeMode === "system" ? (systemScheme === "light" ? "light" : "dark") : themeMode;
    return { scheme, colors: scheme === "light" ? lightColors : darkColors };
  }, [themeMode, systemScheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useColors(): ColorPalette {
  return useContext(ThemeContext).colors;
}

export function useThemeScheme(): "light" | "dark" {
  return useContext(ThemeContext).scheme;
}
