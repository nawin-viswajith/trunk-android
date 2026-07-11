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
import { InferenceScreen } from "../screens/InferenceScreen";
import { withSwipe } from "./SwipeableScreen";

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
      <ProjectsStack.Screen name="Projects List" component={ProjectsScreen} options={{ headerShown: false }} />
      <ProjectsStack.Screen name="Project Detail" component={ProjectDetailScreen} />
    </ProjectsStack.Navigator>
  );
}

function ModelsStackNavigator() {
  const colors = useColors();
  return (
    <ModelsStack.Navigator screenOptions={getStackScreenOptions(colors)}>
      <ModelsStack.Screen name="Models List" component={ModelsScreen} options={{ headerShown: false }} />
      <ModelsStack.Screen name="Browse Hugging Face" component={HuggingFaceSearchScreen} />
      <ModelsStack.Screen name="Hugging Face Files" component={HuggingFaceFilesScreen} />
    </ModelsStack.Navigator>
  );
}

const ICONS: Record<string, string> = {
  Home: "⌂",
  Projects: "▤",
  Models: "◧",
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
        tabBarHideOnKeyboard: true,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarIcon: () => <Text style={{ fontSize: 16, color: colors.textSecondary }}>{ICONS[route.name] ?? "•"}</Text>,
      })}
    >
      <Tab.Screen name="Home" component={withSwipe(HomeScreen)} options={{ headerShown: false }} />
      <Tab.Screen name="Models" component={withSwipe(ModelsStackNavigator)} options={{ headerShown: false }} />
      <Tab.Screen name="Projects" component={withSwipe(ProjectsStackNavigator)} options={{ headerShown: false }} />
      <Tab.Screen name="Inference" component={withSwipe(InferenceScreen)} options={{ headerShown: false }} />
    </Tab.Navigator>
  );
}
