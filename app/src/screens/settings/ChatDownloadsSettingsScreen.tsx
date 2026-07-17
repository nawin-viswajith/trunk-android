import React, { useMemo } from "react";
import { Pressable, ScrollView, StyleSheet, Switch, View } from "react-native";
import { Text } from "../../components/Text";
import { Card } from "../../components/Card";
import { ColorPalette, spacing } from "../../theme/colors";
import { useColors } from "../../theme/ThemeContext";
import { MobileDataDownloadPref, useSettingsStore } from "../../state/useSettingsStore";
import { createScreenStyles } from "../../theme/layout";
import { pickBackupFolder } from "../../services/modelStorage";
import { showAlert } from "../../state/useAlertStore";

const MOBILE_DATA_OPTIONS: { value: MobileDataDownloadPref; label: string }[] = [
  { value: "ask", label: "Ask Always" },
  { value: "wifiOnly", label: "Wi-Fi only" },
  { value: "allow", label: "Allow" },
];

export function ChatDownloadsSettingsScreen() {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const showInferenceStats = useSettingsStore((s) => s.showInferenceStats);
  const setShowInferenceStats = useSettingsStore((s) => s.setShowInferenceStats);
  const mobileDataDownloads = useSettingsStore((s) => s.mobileDataDownloads);
  const setMobileDataDownloads = useSettingsStore((s) => s.setMobileDataDownloads);
  const backupDownloadsEnabled = useSettingsStore((s) => s.backupDownloadsEnabled);
  const setBackupDownloadsEnabled = useSettingsStore((s) => s.setBackupDownloadsEnabled);
  const backupFolderUri = useSettingsStore((s) => s.backupFolderUri);
  const setBackupFolderUri = useSettingsStore((s) => s.setBackupFolderUri);

  // Turning the toggle on always re-prompts the folder picker when no
  // folder is set yet, but never re-prompts once one is granted (even
  // across an off/on cycle) - see backupFolderUri's doc comment.
  const onToggleBackup = async (value: boolean) => {
    if (value && !backupFolderUri) {
      const uri = await pickBackupFolder();
      if (!uri) return; // user cancelled the picker - leave the toggle off
      setBackupFolderUri(uri);
    }
    setBackupDownloadsEnabled(value);
  };

  const onChangeFolder = async () => {
    const uri = await pickBackupFolder();
    if (!uri) return;
    setBackupFolderUri(uri);
    showAlert("Backup folder updated", "New downloads will be copied here from now on.");
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Card>
        <Text style={styles.sectionTitle}>Chat</Text>
        <View style={styles.toggleRow}>
          <View style={styles.toggleTextWrap}>
            <Text style={styles.toggleLabel}>Show response stats</Text>
            <Text style={styles.hint}>Input/output tok/s and time taken, shown under each reply.</Text>
          </View>
          <Switch
            value={showInferenceStats}
            onValueChange={setShowInferenceStats}
            trackColor={{ false: colors.border, true: colors.accent }}
            thumbColor={colors.textPrimary}
          />
        </View>
      </Card>

      <Card>
        <Text style={styles.sectionTitle}>Downloads</Text>
        <Text style={styles.hint}>Whether to allow downloading models over mobile data, or require Wi-Fi.</Text>
        <View style={styles.themeRow}>
          {MOBILE_DATA_OPTIONS.map((opt) => {
            const active = opt.value === mobileDataDownloads;
            return (
              <Pressable
                key={opt.value}
                onPress={() => setMobileDataDownloads(opt.value)}
                style={[styles.themeChip, active && styles.themeChipActive]}
              >
                <Text style={[styles.themeChipLabel, active && styles.themeChipLabelActive]}>{opt.label}</Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.divider} />

        <View style={styles.toggleRow}>
          <View style={styles.toggleTextWrap}>
            <Text style={styles.toggleLabel}>Back up downloads</Text>
            <Text style={styles.hint}>
              Copies each downloaded model to a folder you pick, so it survives uninstalling the app. Models still
              load from the app's own storage either way - this is just a backup copy.
            </Text>
          </View>
          <Switch
            value={backupDownloadsEnabled}
            onValueChange={onToggleBackup}
            trackColor={{ false: colors.border, true: colors.accent }}
            thumbColor={colors.textPrimary}
          />
        </View>
        {backupDownloadsEnabled && backupFolderUri ? (
          <Pressable onPress={onChangeFolder} style={styles.folderRow}>
            <Text style={styles.folderText} numberOfLines={1}>
              {decodeURIComponent(backupFolderUri.split("/").pop() ?? backupFolderUri)}
            </Text>
            <Text style={styles.folderChange}>Change</Text>
          </Pressable>
        ) : null}
      </Card>
    </ScrollView>
  );
}

function createStyles(colors: ColorPalette) {
  const screen = createScreenStyles(colors);
  return StyleSheet.create({
    container: screen.container,
    content: { padding: spacing.md },
    sectionTitle: { color: colors.textPrimary, fontSize: 14, fontWeight: "600", marginBottom: spacing.sm },
    hint: { color: colors.textSecondary, fontSize: 11, marginBottom: spacing.sm },
    toggleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.md },
    toggleTextWrap: { flex: 1 },
    toggleLabel: { color: colors.textPrimary, fontSize: 13, fontWeight: "600", marginBottom: 2 },
    themeRow: { flexDirection: "row", gap: spacing.sm },
    themeChip: { flex: 1, borderWidth: 1, borderColor: colors.border, paddingVertical: spacing.sm, alignItems: "center" },
    themeChipActive: { borderColor: colors.accent, backgroundColor: colors.accent + "22" },
    themeChipLabel: { color: colors.textSecondary, fontSize: 13, fontWeight: "600" },
    themeChipLabelActive: { color: colors.accent },
    divider: { height: 1, backgroundColor: colors.border, marginVertical: spacing.md },
    folderRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.sm,
      marginTop: spacing.sm,
    },
    folderText: { color: colors.textSecondary, fontSize: 12, flex: 1, marginRight: spacing.sm },
    folderChange: { color: colors.accent, fontSize: 12, fontWeight: "600" },
  });
}
