import React, { useMemo, useState } from "react";
import { ScrollView, Share, StyleSheet, View } from "react-native";
import { Text } from "../../components/Text";
import { Button } from "../../components/Button";
import { Card } from "../../components/Card";
import { ColorPalette, spacing } from "../../theme/colors";
import { useColors } from "../../theme/ThemeContext";
import { createScreenStyles } from "../../theme/layout";
import {
  runDiagnostics,
  formatDiagnosticsLog,
  appendDiagnosticsLog,
  clearDiagnosticsLog,
  getDiagnosticsLogPath,
  DiagnosticResult,
} from "../../services/devDiagnostics";

const STATUS_LABEL: Record<DiagnosticResult["status"], string> = {
  pass: "PASS",
  fail: "FAIL",
  skip: "SKIP",
};

/** For whoever is testing the device by hand: run the on-device self-check
 * suite once, then share/copy the resulting log instead of describing what
 * happened over chat — the log is the reproducible artifact. Every check
 * here calls the same services the real screens do (llamaEngine,
 * flowRunner, compatibility), so a failure here is a failure a user would
 * actually hit, not a testing-harness quirk. */
export function DiagnosticsScreen() {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<DiagnosticResult[] | null>(null);
  const [logPath, setLogPath] = useState<string | null>(null);

  const run = async () => {
    setRunning(true);
    setResults(null);
    try {
      const runResults = await runDiagnostics();
      setResults(runResults);
      const path = await appendDiagnosticsLog(formatDiagnosticsLog(runResults));
      setLogPath(path);
    } finally {
      setRunning(false);
    }
  };

  const shareLog = async () => {
    if (!results) return;
    await Share.share({ message: formatDiagnosticsLog(results) });
  };

  const clearLog = async () => {
    await clearDiagnosticsLog();
    setLogPath(null);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Card>
        <Text style={styles.title}>Diagnostics</Text>
        <Text style={styles.subtitle}>
          Runs a fixed suite of on-device checks — device memory, NPU detection, model load, tokenizer, a real
          inference call, context window reload, and a Playground flow run if one exists. Takes longer than a
          normal screen since it actually generates tokens; that's the point.
        </Text>
        <Button label={running ? "Running..." : "Run Diagnostics"} onPress={run} variant="primary" loading={running} />
      </Card>

      {results ? (
        <Card>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryText}>
              {results.filter((r) => r.status === "pass").length} passed ·{" "}
              {results.filter((r) => r.status === "fail").length} failed ·{" "}
              {results.filter((r) => r.status === "skip").length} skipped
            </Text>
            <Button label="Share / Copy" onPress={shareLog} variant="secondary" />
          </View>
          {results.map((r) => (
            <View key={r.name} style={styles.resultRow}>
              <View style={styles.resultHeader}>
                <Text style={[styles.statusBadge, styles[`status_${r.status}` as const]]}>{STATUS_LABEL[r.status]}</Text>
                <Text style={styles.resultName}>{r.name}</Text>
                <Text style={styles.resultDuration}>{r.durationMs}ms</Text>
              </View>
              <Text style={styles.resultDetail} selectable>
                {r.detail}
              </Text>
            </View>
          ))}
        </Card>
      ) : null}

      <Card>
        <Text style={styles.title}>Log file</Text>
        <Text style={styles.subtitle}>
          Every run is appended to a single file on-device (not overwritten), so a history survives app restarts.
        </Text>
        <Text style={styles.pathText} selectable>
          {logPath ?? getDiagnosticsLogPath()}
        </Text>
        <View style={styles.buttonRow}>
          <Button label="Clear log file" onPress={clearLog} variant="neutral" />
        </View>
      </Card>
    </ScrollView>
  );
}

function createStyles(colors: ColorPalette) {
  const screen = createScreenStyles(colors);
  return StyleSheet.create({
    container: screen.container,
    content: { padding: spacing.md, gap: spacing.md },
    title: { color: colors.textPrimary, fontSize: 16, fontWeight: "700", marginBottom: spacing.xs },
    subtitle: { color: colors.textSecondary, fontSize: 12, lineHeight: 17, marginBottom: spacing.md },
    summaryRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: spacing.sm,
      gap: spacing.sm,
    },
    summaryText: { color: colors.textPrimary, fontSize: 12, fontWeight: "600", flexShrink: 1 },
    resultRow: {
      borderWidth: 1,
      borderColor: colors.border,
      borderLeftWidth: 3,
      borderLeftColor: colors.border,
      padding: spacing.sm,
      marginBottom: spacing.xs,
    },
    resultHeader: { flexDirection: "row", alignItems: "center", gap: spacing.xs, marginBottom: spacing.xs },
    statusBadge: { fontSize: 10, fontWeight: "700", fontFamily: "monospace" },
    status_pass: { color: colors.running },
    status_fail: { color: colors.error },
    status_skip: { color: colors.textSecondary },
    resultName: { color: colors.textPrimary, fontSize: 13, fontWeight: "600", flex: 1 },
    resultDuration: { color: colors.textSecondary, fontSize: 10, fontFamily: "monospace" },
    resultDetail: { color: colors.textSecondary, fontSize: 11, fontFamily: "monospace", lineHeight: 15 },
    pathText: { color: colors.textSecondary, fontSize: 10, fontFamily: "monospace", marginBottom: spacing.sm },
    buttonRow: { marginTop: spacing.xs },
  });
}
