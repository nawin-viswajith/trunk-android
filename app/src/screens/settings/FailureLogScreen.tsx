import React, { useCallback, useMemo, useState } from "react";
import { ScrollView, Share, StyleSheet, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Text } from "../../components/Text";
import { Button } from "../../components/Button";
import { Card } from "../../components/Card";
import { ColorPalette, spacing } from "../../theme/colors";
import { useColors } from "../../theme/ThemeContext";
import { createScreenStyles } from "../../theme/layout";
import { getSessionLog, clearErrorLog, formatSessionLog, LogEntry } from "../../services/sessionLog";

export function FailureLogScreen() {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [entries, setEntries] = useState<LogEntry[]>([]);

  const load = useCallback(() => {
    getSessionLog().then((all) => setEntries(all.filter((e) => e.kind === "error")));
  }, []);

  useFocusEffect(load);

  const share = async () => {
    await Share.share({ message: formatSessionLog(entries) });
  };

  const clear = async () => {
    await clearErrorLog();
    setEntries([]);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.headerRow}>
        <Text style={styles.count}>{entries.length} logged</Text>
        <View style={styles.headerButtons}>
          <Button label="Share" onPress={share} variant="secondary" />
          <Button label="Clear" onPress={clear} variant="neutral" />
        </View>
      </View>
      {entries.length === 0 ? <Text style={styles.empty}>No failures logged yet.</Text> : null}
      {entries.map((e, i) => (
        <Card key={i}>
          <Text style={styles.context}>{e.context}</Text>
          <Text style={styles.timestamp}>{new Date(e.timestamp).toLocaleString()}</Text>
          <Text style={styles.message} selectable>
            {e.message}
          </Text>
        </Card>
      ))}
    </ScrollView>
  );
}

function createStyles(colors: ColorPalette) {
  const screen = createScreenStyles(colors);
  return StyleSheet.create({
    container: screen.container,
    content: { padding: spacing.md, gap: spacing.sm },
    headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.sm },
    headerButtons: { flexDirection: "row", gap: spacing.sm },
    count: { color: colors.textSecondary, fontSize: 12, fontWeight: "600" },
    empty: { color: colors.textSecondary, fontSize: 13, textAlign: "center", marginTop: spacing.lg },
    context: { color: colors.error, fontSize: 13, fontWeight: "700" },
    timestamp: { color: colors.textSecondary, fontSize: 10, fontFamily: "monospace", marginTop: 2, marginBottom: spacing.xs },
    message: { color: colors.textPrimary, fontSize: 12, fontFamily: "monospace" },
  });
}
