import "react-native-gesture-handler";
import React, { useEffect, useRef, useState } from "react";
import { AppState, Linking } from "react-native";
import { NavigationContainer, DarkTheme, DefaultTheme } from "@react-navigation/native";
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

SplashScreen.preventAutoHideAsync().catch(() => {});

// User-provided form link — not a guessed URL.
const FEEDBACK_FORM_URL = "https://forms.cloud.microsoft/r/ZetxpjPEkA";
const FEEDBACK_USAGE_THRESHOLD_MS = 10 * 60 * 1000;
const USAGE_TICK_MS = 15000;

function AppInner() {
  const colors = useColors();
  const scheme = useThemeScheme();
  const hasOnboarded = useSettingsStore((s) => s.hasOnboarded);
  const [bootDone, setBootDone] = useState(false);
  const fontsLoaded = useAppFonts();
  const batteryPromptShown = useRef(false);
  const totalUsageMs = useSettingsStore((s) => s.totalUsageMs);
  const feedbackPromptShown = useSettingsStore((s) => s.feedbackPromptShown);
  const hasAnyChatHistory = useProjectStore((s) => s.history.length > 0);
  const feedbackPromptTriggered = useRef(false);

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

    const trySettle = () => {
      if (settled) return;
      if (!useSettingsStore.persist.hasHydrated() || !useProjectStore.persist.hasHydrated()) return;
      settled = true;
      const remaining = Math.max(0, minDuration - (Date.now() - start));
      setTimeout(() => setBootDone(true), remaining);
    };

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
          <NavigationContainer theme={navigationTheme}>
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
