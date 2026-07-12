import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { StatusBadge } from "../components/StatusBadge";
import { ColorPalette, spacing } from "../theme/colors";
import { useColors } from "../theme/ThemeContext";
import { devicesApi } from "../api/devices";
import { useSettingsStore, ThemeMode } from "../state/useSettingsStore";
import { Device } from "../api/types";

const THEME_OPTIONS: { mode: ThemeMode; label: string }[] = [
  { mode: "light", label: "Light" },
  { mode: "dark", label: "Dark" },
  { mode: "system", label: "System" },
];

export function SettingsScreen() {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const backendUrl = useSettingsStore((s) => s.backendUrl);
  const setBackendUrl = useSettingsStore((s) => s.setBackendUrl);
  const activeDeviceSerial = useSettingsStore((s) => s.activeDeviceSerial);
  const setActiveDeviceSerial = useSettingsStore((s) => s.setActiveDeviceSerial);
  const themeMode = useSettingsStore((s) => s.themeMode);
  const setThemeMode = useSettingsStore((s) => s.setThemeMode);

  const [urlInput, setUrlInput] = useState(backendUrl);
  const [devices, setDevices] = useState<Device[]>([]);

  const loadDevices = useCallback(async () => {
    try {
      setDevices(await devicesApi.list());
    } catch {
      setDevices([]);
    }
  }, []);

  useEffect(() => {
    loadDevices();
  }, [loadDevices]);

  const selectDevice = async (serial: string) => {
    await devicesApi.select(serial);
    setActiveDeviceSerial(serial);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Settings</Text>

      <Card>
        <Text style={styles.sectionTitle}>Appearance</Text>
        <View style={styles.themeRow}>
          {THEME_OPTIONS.map((opt) => {
            const active = opt.mode === themeMode;
            return (
              <Pressable
                key={opt.mode}
                onPress={() => setThemeMode(opt.mode)}
                style={[styles.themeChip, active && styles.themeChipActive]}
              >
                <Text style={[styles.themeChipLabel, active && styles.themeChipLabelActive]}>{opt.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </Card>

      <Card>
        <Text style={styles.sectionTitle}>Backend</Text>
        <TextInput
          value={urlInput}
          onChangeText={setUrlInput}
          placeholder="http://localhost:8000"
          placeholderTextColor={colors.textSecondary}
          style={styles.input}
          autoCapitalize="none"
        />
        <Button label="Save" onPress={() => setBackendUrl(urlInput)} />
      </Card>

      <Card>
        <View style={styles.rowBetween}>
          <Text style={styles.sectionTitle}>Devices</Text>
          <Button label="Refresh" onPress={loadDevices} variant="secondary" />
        </View>
        {devices.map((d) => (
          <View key={d.serial} style={styles.deviceRow}>
            <Text
              onPress={() => selectDevice(d.serial)}
              style={[styles.deviceSerial, d.serial === activeDeviceSerial && styles.deviceSerialActive]}
            >
              {d.serial}
            </Text>
            <StatusBadge status={d.state === "device" ? "pass" : "fail"} label={d.state.toUpperCase()} />
          </View>
        ))}
        {devices.length === 0 ? <Text style={styles.value}>No devices found via adb.</Text> : null}
      </Card>
    </ScrollView>
  );
}

function createStyles(colors: ColorPalette) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    content: { padding: spacing.md },
    title: { color: colors.textPrimary, fontSize: 20, fontWeight: "700", marginBottom: spacing.md },
    sectionTitle: { color: colors.textPrimary, fontSize: 14, fontWeight: "600", marginBottom: spacing.sm },
    rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.sm },
    themeRow: { flexDirection: "row", gap: spacing.sm },
    themeChip: {
      flex: 1,
      borderWidth: 1,
      borderColor: colors.border,
      paddingVertical: spacing.sm,
      alignItems: "center",
    },
    themeChipActive: { borderColor: colors.cpu, backgroundColor: colors.cpu + "22" },
    themeChipLabel: { color: colors.textSecondary, fontSize: 13, fontWeight: "600" },
    themeChipLabelActive: { color: colors.cpu },
    input: {
      borderWidth: 1,
      borderColor: colors.border,
      color: colors.textPrimary,
      backgroundColor: colors.surfaceAlt,
      padding: spacing.sm,
      marginBottom: spacing.sm,
    },
    deviceRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 4 },
    deviceSerial: { color: colors.textSecondary, fontFamily: "monospace", fontSize: 13 },
    deviceSerialActive: { color: colors.cpu, fontWeight: "600" },
    value: { color: colors.textSecondary, fontSize: 13 },
  });
}
