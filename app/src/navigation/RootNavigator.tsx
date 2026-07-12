import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { Text } from "react-native";
import { ColorPalette } from "../theme/colors";
import { useColors } from "../theme/ThemeContext";
import { HomeScreen } from "../screens/HomeScreen";
import { ProjectsScreen } from "../screens/ProjectsScreen";
import { ProjectDetailScreen } from "../screens/ProjectDetailScreen";
import { ModelsScreen } from "../screens/ModelsScreen";
import { HuggingFaceSearchScreen } from "../screens/HuggingFaceSearchScreen";
import { HuggingFaceFilesScreen } from "../screens/HuggingFaceFilesScreen";
import { DeploymentWizardScreen } from "../screens/DeploymentWizardScreen";
import { DiagnosticsScreen } from "../screens/DiagnosticsScreen";
import { InferenceScreen } from "../screens/InferenceScreen";

const Tab = createBottomTabNavigator();
const ProjectsStack = createNativeStackNavigator();
const ModelsStack = createNativeStackNavigator();

function getStackScreenOptions(colors: ColorPalette) {
  return {
    headerStyle: { backgroundColor: colors.surface },
    headerTintColor: colors.textPrimary,
    headerShadowVisible: false,
  };
}

function ProjectsStackNavigator() {
  const colors = useColors();
  return (
    <ProjectsStack.Navigator screenOptions={getStackScreenOptions(colors)}>
      <ProjectsStack.Screen name="Projects List" component={ProjectsScreen} />
      <ProjectsStack.Screen name="Project Detail" component={ProjectDetailScreen} />
    </ProjectsStack.Navigator>
  );
}

function ModelsStackNavigator() {
  const colors = useColors();
  return (
    <ModelsStack.Navigator screenOptions={getStackScreenOptions(colors)}>
      <ModelsStack.Screen name="Models List" component={ModelsScreen} />
      <ModelsStack.Screen name="Browse Hugging Face" component={HuggingFaceSearchScreen} />
      <ModelsStack.Screen name="Hugging Face Files" component={HuggingFaceFilesScreen} />
    </ModelsStack.Navigator>
  );
}

const ICONS: Record<string, string> = {
  Home: "⌂",
  Projects: "▤",
  Models: "◧",
  "Deployment Wizard": "⚙",
  Diagnostics: "✚",
  Inference: "▷",
};

export function RootNavigator() {
  const colors = useColors();
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
      <Tab.Screen name="Models" component={ModelsStackNavigator} options={{ headerShown: false }} />
      <Tab.Screen name="Deployment Wizard" component={DeploymentWizardScreen} options={{ headerShown: false }} />
      <Tab.Screen name="Diagnostics" component={DiagnosticsScreen} options={{ headerShown: false }} />
      <Tab.Screen name="Inference" component={InferenceScreen} options={{ headerShown: false }} />
    </Tab.Navigator>
  );
}
