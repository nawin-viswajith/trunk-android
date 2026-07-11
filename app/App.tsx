// Copyright © 2026 TuskerLabs. All rights reserved.
// Unauthorized copying of this file, via any medium, is strictly prohibited.

import "react-native-gesture-handler";
import React, { useEffect, useState } from "react";
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

SplashScreen.preventAutoHideAsync().catch(() => {});

function AppInner() {
  const colors = useColors();
  const scheme = useThemeScheme();
  const hasOnboarded = useSettingsStore((s) => s.hasOnboarded);
  const [bootDone, setBootDone] = useState(false);

  useEffect(() => {
    SplashScreen.hideAsync().catch(() => {});
    // A fresh random minimum each launch (1.5-2.5s) so the splash doesn't
    // feel identical every time -- but real store rehydration always wins
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

  if (!bootDone) {
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
