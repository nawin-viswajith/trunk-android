import React, { useMemo, useState } from "react";
import { FlatList, StyleSheet, Text, View } from "react-native";
import { Button } from "../components/Button";
import { DoctorCheckRow } from "../components/DoctorCheckRow";
import { spacing, ColorPalette } from "../theme/colors";
import { useColors } from "../theme/ThemeContext";
import { diagnosticsApi } from "../api/diagnostics";
import { connectJsonWs } from "../api/ws";
import { useSettingsStore } from "../state/useSettingsStore";
import { CheckResult, DiagnosticsFrame } from "../api/types";

export function DiagnosticsScreen() {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const serial = useSettingsStore((s) => s.activeDeviceSerial);
  const [checks, setChecks] = useState<CheckResult[]>([]);
  const [running, setRunning] = useState(false);

  const run = async () => {
    setChecks([]);
    setRunning(true);
    const { job_id } = await diagnosticsApi.run(serial);
    const disconnect = connectJsonWs<DiagnosticsFrame>(`/ws/diagnostics/${job_id}`, (frame) => {
      if (frame.type === "check") {
        setChecks((prev) => [...prev, frame as unknown as CheckResult]);
      } else if (frame.type === "done") {
        setRunning(false);
        disconnect();
      }
    });
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Diagnostics</Text>
        <Button label="Run Full Check" onPress={run} loading={running} />
      </View>
      <FlatList
        data={checks}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => <DoctorCheckRow check={item} />}
        ListEmptyComponent={
          !running ? <Text style={styles.empty}>Run a full check to see device/environment status.</Text> : null
        }
      />
    </View>
  );
}

function createStyles(colors: ColorPalette) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: {
      padding: spacing.md,
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    title: { color: colors.textPrimary, fontSize: 20, fontWeight: "700" },
    list: { paddingHorizontal: spacing.md, paddingBottom: spacing.lg },
    empty: { color: colors.textSecondary, textAlign: "center", marginTop: spacing.lg },
  });
}
