import React, { useEffect, useMemo, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { Button } from "./Button";
import { ColorPalette, spacing } from "../theme/colors";
import { useColors } from "../theme/ThemeContext";
import { getDeviceDetails, getStorageInfo, DeviceDetails, StorageInfo } from "../utils/deviceInfo";
import { getDeviceMemoryInfo } from "../utils/compatibility";
import { formatBytes } from "../utils/format";

interface Row {
  label: string;
  value: string;
}

export function DeviceDetailsModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [details, setDetails] = useState<DeviceDetails | null>(null);
  const [storage, setStorage] = useState<StorageInfo | null>(null);
  const [memory, setMemory] = useState<{ totalMb: number; availableMb: number } | null>(null);

  useEffect(() => {
    if (!visible) return;
    getDeviceDetails().then(setDetails);
    getStorageInfo().then(setStorage);
    getDeviceMemoryInfo().then(setMemory);
  }, [visible]);

  const rows: Row[] = useMemo(() => {
    const list: Row[] = [];
    if (details) {
      list.push(
        { label: "Manufacturer", value: details.manufacturer },
        { label: "Model", value: `${details.brand} ${details.model}` },
        { label: "Chipset ID", value: details.deviceId },
        { label: "OS", value: `${details.systemName} ${details.systemVersion} (API ${details.apiLevel})` },
        { label: "CPU ABIs", value: details.supportedAbis.join(", ") }
      );
    }
    if (memory) {
      list.push({
        label: "RAM",
        value: `${(memory.totalMb / 1024).toFixed(1)} GB total, ${(memory.availableMb / 1024).toFixed(1)} GB available`,
      });
    }
    if (storage) {
      list.push({
        label: "Storage",
        value: `${formatBytes(storage.totalMb * 1024 * 1024)} total, ${formatBytes(storage.freeMb * 1024 * 1024)} free`,
      });
    }
    return list;
  }, [details, memory, storage]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.card} onPress={() => {}}>
          <Text style={styles.title}>Device Details</Text>
          {rows.map((r) => (
            <View key={r.label} style={styles.row}>
              <Text style={styles.label}>{r.label}</Text>
              <Text style={styles.value}>{r.value}</Text>
            </View>
          ))}
          <Text style={styles.note}>
            CPU/GPU clock speed, core count, GPU/NPU model, and RAM/storage type or speed aren't exposed by any
            public Android API to a regular app -- not shown here because there's no reliable way to read them.
          </Text>
          <View style={styles.buttonRow}>
            <Button label="Close" onPress={onClose} variant="secondary" />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function createStyles(colors: ColorPalette) {
  return StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.6)",
      justifyContent: "center",
      padding: spacing.lg,
    },
    card: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderTopWidth: 3,
      borderTopColor: colors.accentSecondary,
      padding: spacing.lg,
      gap: spacing.sm,
    },
    title: { color: colors.textPrimary, fontSize: 18, fontWeight: "700", marginBottom: spacing.xs },
    row: { flexDirection: "row", justifyContent: "space-between", gap: spacing.sm },
    label: { color: colors.textSecondary, fontSize: 12 },
    value: { color: colors.textPrimary, fontSize: 12, fontFamily: "monospace", flexShrink: 1, textAlign: "right" },
    note: { color: colors.textSecondary, fontSize: 11, marginTop: spacing.xs, lineHeight: 16 },
    buttonRow: { marginTop: spacing.sm },
  });
}
