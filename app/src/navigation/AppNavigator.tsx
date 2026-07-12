import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { AlertModalHost } from "../components/AlertModal";
import { NetworkPromptModal } from "../components/NetworkPromptModal";
import { useColors } from "../theme/ThemeContext";
import { fontFamilyForWeight } from "../theme/fonts";
import { useSettingsStore } from "../state/useSettingsStore";
import { RootNavigator } from "./RootNavigator";
import { SettingsListScreen } from "../screens/settings/SettingsListScreen";
import { AppearanceSettingsScreen } from "../screens/settings/AppearanceSettingsScreen";
import { ChatDownloadsSettingsScreen } from "../screens/settings/ChatDownloadsSettingsScreen";
import { PerformanceSettingsScreen } from "../screens/settings/PerformanceSettingsScreen";
import { AboutSettingsScreen } from "../screens/settings/AboutSettingsScreen";

const Stack = createNativeStackNavigator();

export function AppNavigator() {
  const colors = useColors();
  const useCustomFont = useSettingsStore((s) => s.useCustomFont);
  return (
    <>
      <Stack.Navigator
        screenOptions={{
          headerStyle: { backgroundColor: colors.surface },
          headerTintColor: colors.textPrimary,
          headerTitleStyle: { fontFamily: fontFamilyForWeight("600", useCustomFont) },
          headerShadowVisible: false,
        }}
      >
        <Stack.Screen name="Trunk" component={RootNavigator} options={{ headerShown: false }} />
        <Stack.Screen name="Settings" component={SettingsListScreen} />
        <Stack.Screen name="Appearance Settings" component={AppearanceSettingsScreen} options={{ title: "Appearance" }} />
        <Stack.Screen
          name="Chat & Downloads Settings"
          component={ChatDownloadsSettingsScreen}
          options={{ title: "Chat & Downloads" }}
        />
        <Stack.Screen name="Performance Settings" component={PerformanceSettingsScreen} options={{ title: "Performance" }} />
        <Stack.Screen name="About Settings" component={AboutSettingsScreen} options={{ title: "About" }} />
      </Stack.Navigator>
      <AlertModalHost />
      <NetworkPromptModal />
    </>
  );
}
