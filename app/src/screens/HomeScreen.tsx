import React, { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { Card } from "../components/Card";
import { StatusBadge } from "../components/StatusBadge";
import { spacing, ColorPalette } from "../theme/colors";
import { useColors } from "../theme/ThemeContext";
import { devicesApi } from "../api/devices";
import { deploymentApi } from "../api/deployment";
import { useSettingsStore } from "../state/useSettingsStore";
import { Device, WizardProgress } from "../api/types";

export function HomeScreen({ navigation }: any) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const activeDeviceSerial = useSettingsStore((s) => s.activeDeviceSerial);
  const [devices, setDevices] = useState<Device[]>([]);
  const [progress, setProgress] = useState<WizardProgress | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const list = await devicesApi.list();
      setDevices(list);
      const serial = activeDeviceSerial ?? list[0]?.serial;
      if (serial) {
        const p = await deploymentApi.progress(serial);
        setProgress(p);
      }
    } catch {
      // backend not reachable yet -- surfaced as "not ready" below
    }
  }, [activeDeviceSerial]);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const device = devices.find((d) => d.serial === activeDeviceSerial) ?? devices[0];
  const ready = progress?.ready ?? false;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.textPrimary} />}
    >
      <Text style={styles.title}>PocketCoder</Text>

      <Card>
        <View style={styles.rowBetween}>
          <Text style={styles.cardTitle}>Device Ready</Text>
          <StatusBadge status={ready ? "pass" : "warn"} label={ready ? "READY" : "SETUP NEEDED"} />
        </View>
        <ChecklistLine label="Device connected" ok={!!device && device.state === "device"} styles={styles} colors={colors} />
        <ChecklistLine label="Termux installed" ok={(progress?.statuses?.["1"] ?? null) === "pass"} styles={styles} colors={colors} />
        <ChecklistLine label="llama.cpp deployed" ok={(progress?.statuses?.["3"] ?? null) === "pass"} styles={styles} colors={colors} />
        <ChecklistLine label="Diagnostics passed" ok={(progress?.statuses?.["5"] ?? null) === "pass"} styles={styles} colors={colors} />
      </Card>

      <Card>
        <Text style={styles.cardTitle}>Quick Actions</Text>
        <View style={styles.actionsRow}>
          <QuickAction label="Deploy" onPress={() => navigation.navigate("Deployment Wizard")} styles={styles} />
          <QuickAction label="Diagnostics" onPress={() => navigation.navigate("Diagnostics")} styles={styles} />
          <QuickAction label="Inference" onPress={() => navigation.navigate("Inference")} styles={styles} />
        </View>
      </Card>
    </ScrollView>
  );
}

function ChecklistLine({
  label,
  ok,
  styles,
  colors,
}: {
  label: string;
  ok: boolean;
  styles: ReturnType<typeof createStyles>;
  colors: ColorPalette;
}) {
  return (
    <View style={styles.checklistLine}>
      <Text style={[styles.checkMark, { color: ok ? colors.running : colors.textSecondary }]}>{ok ? "✔" : "○"}</Text>
      <Text style={styles.checklistLabel}>{label}</Text>
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
    container: { flex: 1, backgroundColor: colors.background },
    content: { padding: spacing.md },
    title: {
      color: colors.textPrimary,
      fontSize: 24,
      fontWeight: "700",
      marginBottom: spacing.md,
    },
    cardTitle: {
      color: colors.textPrimary,
      fontSize: 16,
      fontWeight: "600",
      marginBottom: spacing.sm,
    },
    rowBetween: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: spacing.sm,
    },
    checklistLine: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 4,
    },
    checkMark: {
      width: 20,
      fontFamily: "monospace",
    },
    checklistLabel: {
      color: colors.textSecondary,
      fontSize: 13,
    },
    actionsRow: {
      flexDirection: "row",
      gap: spacing.sm,
    },
    quickAction: {
      borderWidth: 1,
      borderColor: colors.border,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
    },
    quickActionText: {
      color: colors.cpu,
      fontWeight: "600",
      fontSize: 13,
    },
  });
}
