import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { Text } from "react-native";
import { colors } from "../theme/colors";
import { HomeScreen } from "../screens/HomeScreen";
import { ProjectsScreen } from "../screens/ProjectsScreen";
import { ProjectDetailScreen } from "../screens/ProjectDetailScreen";
import { ModelsScreen } from "../screens/ModelsScreen";
import { DeploymentWizardScreen } from "../screens/DeploymentWizardScreen";
import { DiagnosticsScreen } from "../screens/DiagnosticsScreen";
import { InferenceScreen } from "../screens/InferenceScreen";

const Tab = createBottomTabNavigator();
const ProjectsStack = createNativeStackNavigator();

function ProjectsStackNavigator() {
  return (
    <ProjectsStack.Navigator screenOptions={stackScreenOptions}>
      <ProjectsStack.Screen name="Projects" component={ProjectsScreen} />
      <ProjectsStack.Screen name="Project Detail" component={ProjectDetailScreen} />
    </ProjectsStack.Navigator>
  );
}

const stackScreenOptions = {
  headerStyle: { backgroundColor: colors.surface },
  headerTintColor: colors.textPrimary,
  headerShadowVisible: false,
};

const ICONS: Record<string, string> = {
  Home: "⌂",
  Projects: "▤",
  Models: "◧",
  "Deployment Wizard": "⚙",
  Diagnostics: "✚",
  Inference: "▷",
};

export function RootNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.textPrimary,
        headerShadowVisible: false,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
        tabBarActiveTintColor: colors.cpu,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarIcon: () => <Text style={{ fontSize: 16, color: colors.textSecondary }}>{ICONS[route.name] ?? "•"}</Text>,
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Projects" component={ProjectsStackNavigator} options={{ headerShown: false }} />
      <Tab.Screen name="Models" component={ModelsScreen} options={{ headerShown: false }} />
      <Tab.Screen name="Deployment Wizard" component={DeploymentWizardScreen} options={{ headerShown: false }} />
      <Tab.Screen name="Diagnostics" component={DiagnosticsScreen} options={{ headerShown: false }} />
      <Tab.Screen name="Inference" component={InferenceScreen} options={{ headerShown: false }} />
    </Tab.Navigator>
  );
}
