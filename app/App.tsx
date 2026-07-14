import "react-native-gesture-handler";
import React, { useEffect, useRef, useState } from "react";
import { AppState, Linking, Share } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { NavigationContainer, DarkTheme, DefaultTheme, NavigationState } from "@react-navigation/native";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AppNavigator } from "./src/navigation/AppNavigator";
import { BootSplash } from "./src/screens/BootSplash";
import { OnboardingFlow } from "./src/screens/onboarding/OnboardingFlow";
import { ThemeProvider, useColors, useThemeScheme } from "./src/theme/ThemeContext";
import { useSettingsStore } from "./src/state/useSettingsStore";
import { useProjectStore } from "./src/state/useProjectStore";
import { useAppFonts } from "./src/theme/fonts";
import { showAlert } from "./src/state/useAlertStore";
import { isBatteryOptimizationExempt, requestBatteryOptimizationExemption } from "./src/services/batteryOptimization";
import { FEEDBACK_FORM_URL } from "./src/copy/links";
import { captureSessionVisibilityFlags } from "./src/state/sessionFlags";
import { useDownloadStore } from "./src/state/useDownloadStore";
import { setKeepAwake } from "./src/services/keepAwake";
import { markSessionBoot, didPreviousSessionError, getSessionLog, formatSessionLog } from "./src/services/sessionLog";
import appJson from "./app.json";

SplashScreen.preventAutoHideAsync().catch(() => {});

const FEEDBACK_USAGE_THRESHOLD_MS = 10 * 60 * 1000;
const USAGE_TICK_MS = 15000;
// Keyed by app version so an update that renames/removes a screen can never
// restore a stale route react-navigation no longer recognizes — worst case
// after an update is falling back to the default initial route, never a crash.
const NAV_STATE_STORAGE_KEY = `pocketcoder-nav-state-${appJson.expo.version}`;

function AppInner() {
  const colors = useColors();
  const scheme = useThemeScheme();
  const hasOnboarded = useSettingsStore((s) => s.hasOnboarded);
  const [bootDone, setBootDone] = useState(false);
  const fontsLoaded = useAppFonts();
  const batteryPromptShown = useRef(false);
  const reportPromptShown = useRef(false);
  const totalUsageMs = useSettingsStore((s) => s.totalUsageMs);
  const feedbackPromptShown = useSettingsStore((s) => s.feedbackPromptShown);
  const hasAnyChatHistory = useProjectStore((s) => s.history.length > 0);
  const feedbackPromptTriggered = useRef(false);
  const hasActiveDownload = useDownloadStore((s) => Object.values(s.downloads).some((d) => d.status === "downloading"));
  const [initialNavState, setInitialNavState] = useState<NavigationState | undefined>(undefined);

  useEffect(() => {
    setKeepAwake("trunk-download", hasActiveDownload);
  }, [hasActiveDownload]);

  // Ticks while the app is actually in the foreground, not wall-clock time —
  // a phone left on Trunk in the background for hours shouldn't count
  // toward "10 minutes of use" the same as active time does.
  useEffect(() => {
    const interval = setInterval(() => {
      if (AppState.currentState === "active") {
        useSettingsStore.getState().addUsageMs(USAGE_TICK_MS);
      }
    }, USAGE_TICK_MS);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (feedbackPromptShown || feedbackPromptTriggered.current) return;
    if (totalUsageMs < FEEDBACK_USAGE_THRESHOLD_MS || !hasAnyChatHistory) return;
    feedbackPromptTriggered.current = true;
    useSettingsStore.getState().setFeedbackPromptShown(true);
    showAlert(
      "Enjoying Trunk?",
      "We'd love to hear what's working and what isn't — it's a short form, and it goes straight to the people building this.",
      [
        { label: "Not now", variant: "neutral" },
        { label: "Give Feedback", onPress: () => Linking.openURL(FEEDBACK_FORM_URL) },
      ]
    );
  }, [totalUsageMs, hasAnyChatHistory, feedbackPromptShown]);

  useEffect(() => {
    // Fire-and-forget: Render's free tier spins the backend down after idle,
    // so ping it the moment the app opens rather than waiting for the user
    // to reach Hugging Face search — the ~30-50s cold start then happens
    // quietly in the background while they're still on Home/onboarding.
    fetch(`${useSettingsStore.getState().backendUrl}/api/health`).catch(() => {});
  }, []);

  useEffect(() => {
    SplashScreen.hideAsync().catch(() => {});
    // A fresh random minimum each launch (1.5-2.5s) so the splash doesn't
    // feel identical every time — but real store rehydration always wins
    // if it takes longer than that minimum.
    const minDuration = 1500 + Math.random() * 1000;
    const start = Date.now();
    let settled = false;
    let navStateLoaded = false;

    const trySettle = () => {
      if (settled) return;
      if (!useSettingsStore.persist.hasHydrated() || !useProjectStore.persist.hasHydrated() || !navStateLoaded) return;
      settled = true;
      captureSessionVisibilityFlags();
      markSessionBoot();
      const remaining = Math.max(0, minDuration - (Date.now() - start));
      setTimeout(() => setBootDone(true), remaining);
    };

    // Restores whichever tab/stack screen the user was last on — without
    // this, react-navigation always starts at its default initial route,
    // which is invisible as long as the OS keeps the JS process alive across
    // a background/foreground cycle, but very visible the moment Android
    // kills the process for memory (common here, given how much RAM a loaded
    // model can hold) and cold-starts it back on resume - "sometimes it
    // worked, sometimes it failed" is exactly that process-survival coin flip.
    AsyncStorage.getItem(NAV_STATE_STORAGE_KEY)
      .then((raw) => {
        if (raw) setInitialNavState(JSON.parse(raw));
      })
      .catch(() => {})
      .finally(() => {
        navStateLoaded = true;
        trySettle();
      });

    const unsubSettings = useSettingsStore.persist.onFinishHydration(trySettle);
    const unsubProject = useProjectStore.persist.onFinishHydration(trySettle);
    trySettle();

    return () => {
      unsubSettings();
      unsubProject();
    };
  }, []);

  useEffect(() => {
    // Checked once per fresh app process, only once onboarding is already
    // done (first-ever launch has its own flow to get through first) — if
    // the user dismisses this, Settings > Performance still offers the same
    // action, so nothing is lost by skipping it here.
    if (!bootDone || !hasOnboarded || batteryPromptShown.current) return;
    batteryPromptShown.current = true;
    isBatteryOptimizationExempt().then((exempt) => {
      if (exempt) return;
      showAlert(
        "Keep Trunk running in the background?",
        "Downloads and inference are less likely to be interrupted if Trunk is exempt from battery optimization. You can always change this later in Settings.",
        [
          { label: "Not now", variant: "neutral" },
          { label: "Allow", onPress: requestBatteryOptimizationExemption },
        ]
      );
    });
  }, [bootDone, hasOnboarded]);

  useEffect(() => {
    // Only makes sense once usage logging is actually on - errors are
    // logged regardless, but there's nothing to proactively offer to send
    // if the user never opted into that in the first place.
    if (!bootDone || !hasOnboarded || !useSettingsStore.getState().usageLoggingEnabled || reportPromptShown.current) return;
    reportPromptShown.current = true;
    didPreviousSessionError().then((hadError) => {
      if (!hadError) return;
      showAlert(
        "Trunk had a problem last time",
        "Want to send a report? It'll go through your own share sheet - nothing is sent automatically.",
        [
          { label: "Not now", variant: "neutral" },
          {
            label: "Send Logs",
            onPress: async () => {
              const entries = await getSessionLog();
              await Share.share({ message: formatSessionLog(entries) });
            },
          },
        ]
      );
    });
  }, [bootDone, hasOnboarded]);

  const navigationTheme = {
    ...(scheme === "light" ? DefaultTheme : DarkTheme),
    colors: {
      ...(scheme === "light" ? DefaultTheme.colors : DarkTheme.colors),
      background: colors.background,
      card: colors.surface,
      text: colors.textPrimary,
      border: colors.border,
      primary: colors.accent,
    },
  };

  if (!bootDone || !fontsLoaded) {
    return <BootSplash />;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        {!hasOnboarded ? (
          <OnboardingFlow />
        ) : (
          <NavigationContainer
            theme={navigationTheme}
            initialState={initialNavState}
            onStateChange={(state) => {
              AsyncStorage.setItem(NAV_STATE_STORAGE_KEY, JSON.stringify(state)).catch(() => {});
            }}
          >
            <AppNavigator />
          </NavigationContainer>
        )}
        <StatusBar style={scheme === "light" ? "dark" : "light"} />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AppInner />
    </ThemeProvider>
  );
}
