import "react-native-gesture-handler";
import React from "react";
import { NavigationContainer, DarkTheme, DefaultTheme } from "@react-navigation/native";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { AppNavigator } from "./src/navigation/AppNavigator";
import { ThemeProvider, useColors, useThemeScheme } from "./src/theme/ThemeContext";

function AppInner() {
  const colors = useColors();
  const scheme = useThemeScheme();

  const navigationTheme = {
    ...(scheme === "light" ? DefaultTheme : DarkTheme),
    colors: {
      ...(scheme === "light" ? DefaultTheme.colors : DarkTheme.colors),
      background: colors.background,
      card: colors.surface,
      text: colors.textPrimary,
      border: colors.border,
      primary: colors.cpu,
    },
  };

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <NavigationContainer theme={navigationTheme}>
        <AppNavigator />
      </NavigationContainer>
      <StatusBar style={scheme === "light" ? "dark" : "light"} />
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
