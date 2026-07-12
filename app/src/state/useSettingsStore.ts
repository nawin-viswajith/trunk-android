import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { DEFAULT_ACCENT_PRESET, SecretThemeId } from "../theme/colors";

export type ThemeMode = "light" | "dark" | "system";
/** Two contrast levels for dark mode specifically — "standard" is the
 * existing dark-grey background, "pitchBlack" is true OLED black. Has no
 * effect while in light mode. */
export type DarkContrast = "standard" | "pitchBlack";

/** "ask" prompts every time a download starts on cellular; "allow"/"wifiOnly"
 * are set by checking "Remember my choice" in that prompt (see
 * downloadPolicy.ts) and skip the prompt from then on. */
export type MobileDataDownloadPref = "ask" | "allow" | "wifiOnly";

interface SettingsState {
  backendUrl: string;
  themeMode: ThemeMode;
  darkContrast: DarkContrast;
  /** A name from ACCENT_PRESETS, or "custom" to use the three custom colors below. */
  accentPreset: string;
  /** Hex colors used only when accentPreset === "custom". */
  customPrimaryColor: string;
  customSecondaryColor: string;
  customTertiaryColor: string;
  /** Show the per-response input/output tok/s + time-taken line in chat. */
  showInferenceStats: boolean;
  /** Flips true once the first-launch onboarding flow (intro, data-loss
   * warning, mandatory theme setup) has been completed. */
  hasOnboarded: boolean;
  mobileDataDownloads: MobileDataDownloadPref;
  /** Cuts the llama.cpp thread count to save battery/heat at the cost of
   * generation speed — see LITE_MODE_THREADS in llamaEngine.ts. */
  liteMode: boolean;
  /** true = Urbanist (see theme/fonts.ts), false = platform default system font. */
  useCustomFont: boolean;
  /** Once true, the hidden theme picker stays visible in Settings forever —
   * found via 7 taps on the app icon in the About section. */
  secretThemesUnlocked: boolean;
  /** "none" = normal light/dark + accent-preset resolution; anything else
   * fully overrides it (see SECRET_THEMES in theme/colors.ts). */
  secretTheme: SecretThemeId | "none";
  setBackendUrl: (url: string) => void;
  setThemeMode: (mode: ThemeMode) => void;
  setDarkContrast: (contrast: DarkContrast) => void;
  setAccentPreset: (name: string) => void;
  setCustomColors: (primaryHex: string, secondaryHex: string, tertiaryHex: string) => void;
  setShowInferenceStats: (show: boolean) => void;
  setHasOnboarded: (value: boolean) => void;
  setMobileDataDownloads: (pref: MobileDataDownloadPref) => void;
  setLiteMode: (value: boolean) => void;
  setUseCustomFont: (value: boolean) => void;
  unlockSecretThemes: () => void;
  setSecretTheme: (theme: SecretThemeId | "none") => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      backendUrl: "http://localhost:8000",
      themeMode: "system", // follow the OS preference until the user picks explicitly
      darkContrast: "standard",
      accentPreset: DEFAULT_ACCENT_PRESET,
      customPrimaryColor: "#3D7CFF",
      customSecondaryColor: "#22D3EE",
      customTertiaryColor: "#818CF8",
      showInferenceStats: true,
      hasOnboarded: false,
      mobileDataDownloads: "ask",
      liteMode: false,
      useCustomFont: true,
      secretThemesUnlocked: false,
      secretTheme: "none",
      setBackendUrl: (url) => set({ backendUrl: url }),
      setThemeMode: (mode) => set({ themeMode: mode }),
      setDarkContrast: (contrast) => set({ darkContrast: contrast }),
      setAccentPreset: (name) => set({ accentPreset: name }),
      setCustomColors: (primaryHex, secondaryHex, tertiaryHex) =>
        set({
          customPrimaryColor: primaryHex,
          customSecondaryColor: secondaryHex,
          customTertiaryColor: tertiaryHex,
          accentPreset: "custom",
        }),
      setShowInferenceStats: (show) => set({ showInferenceStats: show }),
      setHasOnboarded: (value) => set({ hasOnboarded: value }),
      setMobileDataDownloads: (pref) => set({ mobileDataDownloads: pref }),
      setLiteMode: (value) => set({ liteMode: value }),
      setUseCustomFont: (value) => set({ useCustomFont: value }),
      unlockSecretThemes: () => set({ secretThemesUnlocked: true }),
      setSecretTheme: (theme) => set({ secretTheme: theme }),
    }),
    {
      name: "pocketcoder-settings",
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
