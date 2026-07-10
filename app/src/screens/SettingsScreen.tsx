import React, { useCallback, useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { StatusBadge } from "../components/StatusBadge";
import { colors, spacing } from "../theme/colors";
import { devicesApi } from "../api/devices";
import { useSettingsStore } from "../state/useSettingsStore";
import { Device } from "../api/types";

export function SettingsScreen() {
  const backendUrl = useSettingsStore((s) => s.backendUrl);
  const setBackendUrl = useSettingsStore((s) => s.setBackendUrl);
  const activeDeviceSerial = useSettingsStore((s) => s.activeDeviceSerial);
  const setActiveDeviceSerial = useSettingsStore((s) => s.setActiveDeviceSerial);

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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md },
  title: { color: colors.textPrimary, fontSize: 20, fontWeight: "700", marginBottom: spacing.md },
  sectionTitle: { color: colors.textPrimary, fontSize: 14, fontWeight: "600", marginBottom: spacing.sm },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.sm },
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
