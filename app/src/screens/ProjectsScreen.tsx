import React, { useMemo, useState } from "react";
import { FlatList, StyleSheet, Text, TextInput, View } from "react-native";
import { Button } from "../components/Button";
import { ProjectCard } from "../components/ProjectCard";
import { ColorPalette, spacing } from "../theme/colors";
import { useColors } from "../theme/ThemeContext";
import { useProjectStore } from "../state/useProjectStore";

export function ProjectsScreen({ navigation }: any) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const projects = useProjectStore((s) => s.projects);
  const createProject = useProjectStore((s) => s.createProject);
  const [newName, setNewName] = useState("");

  const create = () => {
    if (!newName.trim()) return;
    createProject(newName.trim());
    setNewName("");
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Projects</Text>
      <View style={styles.createRow}>
        <TextInput
          value={newName}
          onChangeText={setNewName}
          placeholder="New project name"
          placeholderTextColor={colors.textSecondary}
          style={styles.input}
        />
        <Button label="Create" onPress={create} />
      </View>
      <FlatList
        data={projects}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <ProjectCard project={item} onPress={() => navigation.navigate("Project Detail", { projectId: item.id })} />
        )}
        ListEmptyComponent={<Text style={styles.empty}>No projects yet -- create one above.</Text>}
      />
    </View>
  );
}

function createStyles(colors: ColorPalette) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    title: { color: colors.textPrimary, fontSize: 20, fontWeight: "700", padding: spacing.md, paddingBottom: spacing.sm },
    createRow: { flexDirection: "row", gap: spacing.sm, paddingHorizontal: spacing.md, marginBottom: spacing.md },
    input: {
      flex: 1,
      borderWidth: 1,
      borderColor: colors.border,
      color: colors.textPrimary,
      paddingHorizontal: spacing.sm,
      backgroundColor: colors.surface,
    },
    list: { paddingHorizontal: spacing.md, paddingBottom: spacing.lg },
    empty: { color: colors.textSecondary, textAlign: "center", marginTop: spacing.lg },
  });
}
