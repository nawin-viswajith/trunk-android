import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { DEFAULT_ACCENT_PRESET, SecretThemeId } from "../theme/colors";

export type ThemeMode = "light" | "dark" | "system";
/** Two contrast levels for dark mode specifically - "standard" is the
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
   * generation speed - see LITE_MODE_THREADS in llamaEngine.ts. */
  liteMode: boolean;
  /** Offloads inference to the Hexagon NPU (HTP) when llama.rn detects one -
   * experimental, and only tested on Qualcomm SM8450+ (Snapdragon 8 Gen 1+).
   * Silently has no effect on unsupported hardware; see detectNpuDevices in
   * llamaEngine.ts. Defaults off since it's unverified on most devices. */
  npuAcceleration: boolean;
  /** Offloads inference to the Adreno GPU via OpenCL when llama.rn detects
   * one — scoped to Qualcomm Adreno 700+ (see llama.rn's OpenCL section),
   * and mutually exclusive with NPU in practice (see ensureLoaded in
   * llamaEngine.ts — NPU wins if both are somehow on; combining them is a
   * future hybrid mode, not this toggle pair). Defaults off for the same
   * reason NPU does — unverified on most devices. */
  gpuAcceleration: boolean;
  /** Keeps the screen from sleeping while a model is downloading or a
   * response is generating - off by default since it costs battery, same
   * opt-in convention as Lite Mode/NPU/GPU. */
  keepScreenOnDuringActivity: boolean;
  /** true = Urbanist (see theme/fonts.ts), false = platform default system font. */
  useCustomFont: boolean;
  /** Once true, the hidden theme picker stays visible in Settings forever -
   * found via 7 taps on the app icon in the About section. */
  secretThemesUnlocked: boolean;
  /** "none" = normal light/dark + accent-preset resolution; anything else
   * fully overrides it (see SECRET_THEMES in theme/colors.ts). */
  secretTheme: SecretThemeId | "none";
  /** Cumulative foreground time across every launch, in ms — one of the two
   * gates (alongside having sent at least one message) on showing the
   * feedback prompt once, ever. See usageTracking.ts. */
  totalUsageMs: number;
  /** Once true, the feedback prompt never shows again this install. */
  feedbackPromptShown: boolean;
  /** Off by default (opt-in): whether sessionLog.ts records general usage
   * events (model loads, downloads, flow runs) alongside errors, which are
   * always logged regardless of this flag. See LogConsentScreen.tsx. */
  usageLoggingEnabled: boolean;
  /** Once true, LogConsentScreen never needs to show again before "Send
   * Logs" — the user has already seen what is/isn't collected. */
  logConsentSeen: boolean;
  /** On by default (unlike Usage Logging) - offers to auto-send a crash
   * report (5s countdown, cancellable) whenever inference/a Flow run fails
   * or the app crashes outright. Distinct from usageLoggingEnabled: this is
   * about *errors*, not general usage telemetry. See CrashReportPrompt.tsx. */
  crashReportingEnabled: boolean;
  /** Once true, the one-time "crash reporting is now on" notice never shows
   * again — shown once after updating to the version that introduced it. */
  crashReportingNoticeSeen: boolean;
  /** Off by default (opt-in): whether a successful model download also gets
   * copied to backupFolderUri, so the model survives an app uninstall.
   * Android's scoped storage means llama.rn still loads models from app
   * storage either way (see modelStorage.ts) - this is a secondary durable
   * copy, not a change of where models actually live. */
  backupDownloadsEnabled: boolean;
  /** SAF (Storage Access Framework) directory URI granted via
   * requestDirectoryPermissionsAsync() - null until the user has picked a
   * folder at least once. Kept even if backupDownloadsEnabled is later
   * turned off, so re-enabling doesn't need the picker again. */
  backupFolderUri: string | null;
  setBackendUrl: (url: string) => void;
  setThemeMode: (mode: ThemeMode) => void;
  setDarkContrast: (contrast: DarkContrast) => void;
  setAccentPreset: (name: string) => void;
  setCustomColors: (primaryHex: string, secondaryHex: string, tertiaryHex: string) => void;
  setShowInferenceStats: (show: boolean) => void;
  setHasOnboarded: (value: boolean) => void;
  setMobileDataDownloads: (pref: MobileDataDownloadPref) => void;
  setLiteMode: (value: boolean) => void;
  setNpuAcceleration: (value: boolean) => void;
  setGpuAcceleration: (value: boolean) => void;
  setKeepScreenOnDuringActivity: (value: boolean) => void;
  setUseCustomFont: (value: boolean) => void;
  unlockSecretThemes: () => void;
  /** Explicit on/off, unlike the tap-to-unlock action above — lets a
   * settings toggle turn the feature back off (re-hiding it, same as
   * Android's own "Disable developer options" switch), requiring the full
   * tap sequence again to bring it back. */
  setSecretThemesUnlocked: (value: boolean) => void;
  setSecretTheme: (theme: SecretThemeId | "none") => void;
  addUsageMs: (ms: number) => void;
  setFeedbackPromptShown: (value: boolean) => void;
  setUsageLoggingEnabled: (value: boolean) => void;
  setLogConsentSeen: (value: boolean) => void;
  setCrashReportingEnabled: (value: boolean) => void;
  setCrashReportingNoticeSeen: (value: boolean) => void;
  setBackupDownloadsEnabled: (value: boolean) => void;
  setBackupFolderUri: (uri: string | null) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      backendUrl: "https://trunk-backend-dev.onrender.com",
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
      npuAcceleration: false,
      gpuAcceleration: false,
      keepScreenOnDuringActivity: false,
      useCustomFont: true,
      secretThemesUnlocked: false,
      secretTheme: "none",
      totalUsageMs: 0,
      feedbackPromptShown: false,
      usageLoggingEnabled: false,
      logConsentSeen: false,
      crashReportingEnabled: true,
      crashReportingNoticeSeen: false,
      backupDownloadsEnabled: false,
      backupFolderUri: null,
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
      setNpuAcceleration: (value) => set({ npuAcceleration: value }),
      setGpuAcceleration: (value) => set({ gpuAcceleration: value }),
      setKeepScreenOnDuringActivity: (value) => set({ keepScreenOnDuringActivity: value }),
      setUseCustomFont: (value) => set({ useCustomFont: value }),
      unlockSecretThemes: () => set({ secretThemesUnlocked: true }),
      setSecretThemesUnlocked: (value) => set({ secretThemesUnlocked: value }),
      setSecretTheme: (theme) => set({ secretTheme: theme }),
      addUsageMs: (ms) => set((state) => ({ totalUsageMs: state.totalUsageMs + ms })),
      setFeedbackPromptShown: (value) => set({ feedbackPromptShown: value }),
      setUsageLoggingEnabled: (value) => set({ usageLoggingEnabled: value }),
      setLogConsentSeen: (value) => set({ logConsentSeen: value }),
      setCrashReportingEnabled: (value) => set({ crashReportingEnabled: value }),
      setCrashReportingNoticeSeen: (value) => set({ crashReportingNoticeSeen: value }),
      setBackupDownloadsEnabled: (value) => set({ backupDownloadsEnabled: value }),
      setBackupFolderUri: (uri) => set({ backupFolderUri: uri }),
    }),
    {
      name: "pocketcoder-settings",
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
