import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { Text } from "../components/Text";
import { ColorPalette } from "../theme/colors";
import { useColors } from "../theme/ThemeContext";
import { fontFamilyForWeight } from "../theme/fonts";
import { useSettingsStore } from "../state/useSettingsStore";
import { HomeScreen } from "../screens/HomeScreen";
import { ProjectsScreen } from "../screens/ProjectsScreen";
import { ProjectDetailScreen } from "../screens/ProjectDetailScreen";
import { ModelsScreen } from "../screens/ModelsScreen";
import { HuggingFaceSearchScreen } from "../screens/HuggingFaceSearchScreen";
import { HuggingFaceFilesScreen } from "../screens/HuggingFaceFilesScreen";
import { InferenceScreen } from "../screens/InferenceScreen";
import { FlowListScreen } from "../screens/playground/FlowListScreen";
import { AgentLibraryScreen } from "../screens/playground/AgentLibraryScreen";
import { FlowEditorScreen } from "../screens/playground/FlowEditorScreen";
import { RunFlowScreen } from "../screens/playground/RunFlowScreen";
import { withSwipe } from "./SwipeableScreen";

const Tab = createBottomTabNavigator();
const ProjectsStack = createNativeStackNavigator();
const ModelsStack = createNativeStackNavigator();
const PlaygroundStack = createNativeStackNavigator();

function getStackScreenOptions(colors: ColorPalette, useCustomFont: boolean) {
  return {
    headerStyle: { backgroundColor: colors.surface },
    headerTintColor: colors.textPrimary,
    headerTitleStyle: { fontFamily: fontFamilyForWeight("600", useCustomFont) },
    headerShadowVisible: false,
  };
}

function ProjectsStackNavigator() {
  const colors = useColors();
  const useCustomFont = useSettingsStore((s) => s.useCustomFont);
  return (
    <ProjectsStack.Navigator screenOptions={getStackScreenOptions(colors, useCustomFont)}>
      <ProjectsStack.Screen name="Projects List" component={ProjectsScreen} options={{ headerShown: false }} />
      <ProjectsStack.Screen name="Project Detail" component={ProjectDetailScreen} />
    </ProjectsStack.Navigator>
  );
}

function ModelsStackNavigator() {
  const colors = useColors();
  const useCustomFont = useSettingsStore((s) => s.useCustomFont);
  return (
    <ModelsStack.Navigator screenOptions={getStackScreenOptions(colors, useCustomFont)}>
      <ModelsStack.Screen name="Models List" component={ModelsScreen} options={{ headerShown: false }} />
      <ModelsStack.Screen name="Browse Hugging Face" component={HuggingFaceSearchScreen} />
      <ModelsStack.Screen name="Hugging Face Files" component={HuggingFaceFilesScreen} />
    </ModelsStack.Navigator>
  );
}

function PlaygroundStackNavigator() {
  const colors = useColors();
  const useCustomFont = useSettingsStore((s) => s.useCustomFont);
  return (
    <PlaygroundStack.Navigator screenOptions={getStackScreenOptions(colors, useCustomFont)}>
      <PlaygroundStack.Screen name="Flow List" component={FlowListScreen} options={{ headerShown: false }} />
      <PlaygroundStack.Screen name="Agent Library" component={AgentLibraryScreen} />
      <PlaygroundStack.Screen name="Flow Editor" component={FlowEditorScreen} options={{ headerShown: false }} />
      <PlaygroundStack.Screen name="Run Flow" component={RunFlowScreen} options={{ headerShown: false }} />
    </PlaygroundStack.Navigator>
  );
}

const ICONS: Record<string, string> = {
  Home: "\u2302",
  Projects: "\u25A4",
  Models: "\u25E7",
  Inference: "\u25B7",
  Playground: "\u25C8",
};

export function RootNavigator() {
  const colors = useColors();
  const useCustomFont = useSettingsStore((s) => s.useCustomFont);
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.textPrimary,
        headerTitleStyle: { fontFamily: fontFamilyForWeight("600", useCustomFont) },
        headerShadowVisible: false,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
        tabBarLabelStyle: { fontFamily: fontFamilyForWeight(undefined, useCustomFont) },
        tabBarHideOnKeyboard: true,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textSecondary,
        // Uses the `color` react-navigation passes in (already resolved from
        // tabBarActiveTintColor/tabBarInactiveTintColor below) instead of a
        // hardcoded one - otherwise the icon glyph never reflects the
        // selected tab, only the label text underneath it does.
        tabBarIcon: ({ color }: { color: string }) => <Text style={{ fontSize: 16, color }}>{ICONS[route.name] ?? "•"}</Text>,
      })}
    >
      <Tab.Screen name="Home" component={withSwipe(HomeScreen)} options={{ headerShown: false }} />
      <Tab.Screen name="Models" component={withSwipe(ModelsStackNavigator)} options={{ headerShown: false }} />
      <Tab.Screen name="Projects" component={withSwipe(ProjectsStackNavigator)} options={{ headerShown: false }} />
      <Tab.Screen name="Playground" component={withSwipe(PlaygroundStackNavigator)} options={{ headerShown: false }} />
      <Tab.Screen name="Inference" component={withSwipe(InferenceScreen)} options={{ headerShown: false }} />
    </Tab.Navigator>
  );
}
