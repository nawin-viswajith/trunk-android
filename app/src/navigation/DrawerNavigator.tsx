import React from "react";
import { createDrawerNavigator } from "@react-navigation/drawer";
import { colors } from "../theme/colors";
import { RootNavigator } from "./RootNavigator";
import { LogsScreen } from "../screens/LogsScreen";
import { SettingsScreen } from "../screens/SettingsScreen";

const Drawer = createDrawerNavigator();

export function DrawerNavigator() {
  return (
    <Drawer.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.textPrimary,
        headerShadowVisible: false,
        drawerStyle: { backgroundColor: colors.surface },
        drawerActiveTintColor: colors.cpu,
        drawerInactiveTintColor: colors.textSecondary,
        drawerActiveBackgroundColor: colors.surfaceAlt,
      }}
    >
      <Drawer.Screen name="PocketCoder" component={RootNavigator} options={{ headerShown: false }} />
      <Drawer.Screen name="Logs" component={LogsScreen} options={{ headerShown: false }} />
      <Drawer.Screen name="Settings" component={SettingsScreen} options={{ headerShown: false }} />
    </Drawer.Navigator>
  );
}
