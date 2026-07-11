import React, { useCallback, useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import DeviceInfo from "react-native-device-info";
import { Card } from "../components/Card";
import { spacing, ColorPalette } from "../theme/colors";
import { useColors } from "../theme/ThemeContext";
import { useProjectStore } from "../state/useProjectStore";
import { getTotalStorageUsed, listLocalModels } from "../services/modelStorage";
import { getSuggestedModelBudget, SuggestedModelBudget } from "../utils/compatibility";
import { formatBytes } from "../utils/format";

export function HomeScreen({ navigation }: any) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const projectCount = useProjectStore((s) => s.projects.length);
  const [modelCount, setModelCount] = useState(0);
  const [storageUsed, setStorageUsed] = useState(0);
  const [budget, setBudget] = useState<SuggestedModelBudget | null>(null);

  const load = useCallback(async () => {
    const [models, used, suggested] = await Promise.all([
      listLocalModels(),
      getTotalStorageUsed(),
      getSuggestedModelBudget(),
    ]);
    setModelCount(models.length);
    setStorageUsed(used);
    setBudget(suggested);
  }, []);

  useEffect(() => {
    load();
    const unsubscribe = navigation.addListener("focus", load);
    return unsubscribe;
  }, [navigation, load]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>PocketCoder</Text>

      <Card>
        <Text style={styles.cardTitle}>This Device</Text>
        <Text style={styles.value}>{DeviceInfo.getModel()}</Text>
        {budget ? (
          <>
            <Text style={styles.value}>
              {budget.totalMb >= 1024 ? `${(budget.totalMb / 1024).toFixed(1)} GB` : `${budget.totalMb.toFixed(0)} MB`} RAM
            </Text>
            <View style={styles.suggestionBox}>
              <Text style={styles.suggestionLabel}>Suggested model size</Text>
              <Text style={styles.suggestionValue}>
                up to ~{budget.maxParamsBillion.toFixed(1)}B parameters (Q4)
              </Text>
              <Text style={styles.suggestionNote}>
                Larger models may still run but can bottleneck or crash from out-of-memory -- Model Manager flags this per file.
              </Text>
            </View>
          </>
        ) : (
          <Text style={styles.value}>Could not read device memory.</Text>
        )}
      </Card>

      <Card>
        <Text style={styles.cardTitle}>Library</Text>
        <Text style={styles.value}>{modelCount} model{modelCount === 1 ? "" : "s"} downloaded -- {formatBytes(storageUsed)}</Text>
        <Text style={styles.value}>{projectCount} project{projectCount === 1 ? "" : "s"}</Text>
      </Card>

      <Card>
        <Text style={styles.cardTitle}>Quick Actions</Text>
        <View style={styles.actionsRow}>
          <QuickAction label="Models" onPress={() => navigation.navigate("Models")} styles={styles} />
          <QuickAction label="Projects" onPress={() => navigation.navigate("Projects")} styles={styles} />
          <QuickAction label="Inference" onPress={() => navigation.navigate("Inference")} styles={styles} />
        </View>
      </Card>
    </View>
  );
}

function QuickAction({
  label,
  onPress,
  styles,
}: {
  label: string;
  onPress: () => void;
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <View style={styles.quickAction}>
      <Text onPress={onPress} style={styles.quickActionText}>
        {label}
      </Text>
    </View>
  );
}

function createStyles(colors: ColorPalette) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background, padding: spacing.md },
    title: { color: colors.textPrimary, fontSize: 24, fontWeight: "700", marginBottom: spacing.md },
    cardTitle: { color: colors.textPrimary, fontSize: 16, fontWeight: "600", marginBottom: spacing.sm },
    value: { color: colors.textSecondary, fontSize: 13, marginBottom: 2 },
    suggestionBox: {
      borderWidth: 1,
      borderColor: colors.cpu,
      backgroundColor: colors.surfaceAlt,
      padding: spacing.sm,
      marginTop: spacing.sm,
    },
    suggestionLabel: { color: colors.textSecondary, fontSize: 11, fontFamily: "monospace" },
    suggestionValue: { color: colors.cpu, fontSize: 16, fontWeight: "700", marginTop: 2 },
    suggestionNote: { color: colors.textSecondary, fontSize: 11, marginTop: spacing.xs },
    actionsRow: { flexDirection: "row", gap: spacing.sm },
    quickAction: {
      flex: 1,
      borderWidth: 1,
      borderColor: colors.border,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      alignItems: "center",
    },
    quickActionText: { color: colors.cpu, fontWeight: "600", fontSize: 13 },
  });
}
