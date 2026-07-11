import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useColors } from "../theme/ThemeContext";
import { RootNavigator } from "./RootNavigator";
import { SettingsScreen } from "../screens/SettingsScreen";

const Stack = createNativeStackNavigator();

export function AppNavigator() {
  const colors = useColors();
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.textPrimary,
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen name="PocketCoder" component={RootNavigator} options={{ headerShown: false }} />
      <Stack.Screen name="Settings" component={SettingsScreen} />
    </Stack.Navigator>
  );
}
