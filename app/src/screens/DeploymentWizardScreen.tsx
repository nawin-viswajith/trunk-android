import React, { useCallback, useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { WizardStepRow } from "../components/WizardStepRow";
import { colors, spacing } from "../theme/colors";
import { deploymentApi } from "../api/deployment";
import { connectJsonWs } from "../api/ws";
import { useSettingsStore } from "../state/useSettingsStore";
import { CheckStatus, WizardProgress } from "../api/types";

export function DeploymentWizardScreen() {
  const serial = useSettingsStore((s) => s.activeDeviceSerial);
  const [progress, setProgress] = useState<WizardProgress | null>(null);
  const [runningStep, setRunningStep] = useState<number | null>(null);

  const load = useCallback(async () => {
    if (!serial) return;
    setProgress(await deploymentApi.progress(serial));
  }, [serial]);

  useEffect(() => {
    load();
  }, [load]);

  const runStep = async (stepId: number) => {
    if (!serial) return;
    setRunningStep(stepId);
    const { job_id } = await deploymentApi.runStep(stepId, serial);
    const disconnect = connectJsonWs<{ type: string; status?: CheckStatus }>(`/ws/deployment/${job_id}`, () => {
      setRunningStep(null);
      disconnect();
      load();
    });
  };

  if (!serial) {
    return (
      <View style={styles.container}>
        <Text style={styles.empty}>Select a device in Settings first.</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Deployment Wizard</Text>
      <Text style={styles.subtitle}>CPU backend setup -- no terminal required.</Text>
      {(progress?.steps ?? []).map((step) => (
        <WizardStepRow
          key={step.id}
          index={step.id}
          title={step.title}
          status={progress?.statuses?.[String(step.id)] ?? "pending"}
          running={runningStep === step.id}
          onRun={() => runStep(step.id)}
        />
      ))}
      {progress?.ready ? <Text style={styles.ready}>Ready -- go to Inference to launch your model.</Text> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md },
  title: { color: colors.textPrimary, fontSize: 20, fontWeight: "700" },
  subtitle: { color: colors.textSecondary, fontSize: 13, marginBottom: spacing.md },
  empty: { color: colors.textSecondary, textAlign: "center", marginTop: spacing.lg, padding: spacing.md },
  ready: { color: colors.running, fontWeight: "600", marginTop: spacing.sm },
});
