import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { Pressable, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useColors } from "../theme/ThemeContext";
import { RootNavigator } from "./RootNavigator";
import { LogsScreen } from "../screens/LogsScreen";
import { SettingsScreen } from "../screens/SettingsScreen";

const Stack = createNativeStackNavigator();

function HeaderButtons() {
  const colors = useColors();
  const navigation = useNavigation<any>();
  return (
    <View style={{ flexDirection: "row", gap: 16, paddingRight: 4 }}>
      <Pressable onPress={() => navigation.navigate("Logs")} hitSlop={12}>
        <Text style={{ fontSize: 13, color: colors.textSecondary }}>LOGS</Text>
      </Pressable>
      <Pressable onPress={() => navigation.navigate("Settings")} hitSlop={12}>
        <Text style={{ fontSize: 13, color: colors.textSecondary }}>SETTINGS</Text>
      </Pressable>
    </View>
  );
}

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
      <Stack.Screen
        name="PocketCoder"
        component={RootNavigator}
        options={{ headerRight: () => <HeaderButtons /> }}
      />
      <Stack.Screen name="Logs" component={LogsScreen} />
      <Stack.Screen name="Settings" component={SettingsScreen} />
    </Stack.Navigator>
  );
}
