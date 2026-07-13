import React, { useCallback, useMemo, useState } from "react";
import { ScrollView, StyleSheet, Switch, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Text } from "../../components/Text";
import { Button } from "../../components/Button";
import { Card } from "../../components/Card";
import { ColorPalette, spacing } from "../../theme/colors";
import { useColors } from "../../theme/ThemeContext";
import { useSettingsStore } from "../../state/useSettingsStore";
import { showAlert } from "../../state/useAlertStore";
import { isBatteryOptimizationExempt, requestBatteryOptimizationExemption } from "../../services/batteryOptimization";
import { detectNpuDevices, detectGpuDevices } from "../../services/llamaEngine";
import { createScreenStyles } from "../../theme/layout";

export function PerformanceSettingsScreen() {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const liteMode = useSettingsStore((s) => s.liteMode);
  const setLiteMode = useSettingsStore((s) => s.setLiteMode);
  const npuAcceleration = useSettingsStore((s) => s.npuAcceleration);
  const setNpuAcceleration = useSettingsStore((s) => s.setNpuAcceleration);
  const gpuAcceleration = useSettingsStore((s) => s.gpuAcceleration);
  const setGpuAcceleration = useSettingsStore((s) => s.setGpuAcceleration);
  // null while unknown (not yet checked this focus) — the card renders
  // nothing until resolved, rather than flashing then disappearing.
  const [batteryExempt, setBatteryExempt] = useState<boolean | null>(null);
  const [npuDevices, setNpuDevices] = useState<string[] | null>(null);
  const [gpuDevices, setGpuDevices] = useState<string[] | null>(null);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      isBatteryOptimizationExempt().then((exempt) => {
        if (!cancelled) setBatteryExempt(exempt);
      });
      detectNpuDevices().then((devices) => {
        if (!cancelled) setNpuDevices(devices);
      });
      detectGpuDevices().then((devices) => {
        if (!cancelled) setGpuDevices(devices);
      });
      return () => {
        cancelled = true;
      };
    }, [])
  );

  const onToggleLiteMode = (value: boolean) => {
    setLiteMode(value);
    if (value) {
      showAlert(
        "Lite Mode enabled",
        "Lite Mode reduces the CPU threads used for generation to save battery and heat. Generation will be noticeably slower, and larger models may fail to respond in time.",
        [{ label: "OK" }]
      );
    }
  };

  const onToggleNpuAcceleration = (value: boolean) => {
    setNpuAcceleration(value);
    // NPU and GPU offload are mutually exclusive for now (see ensureLoaded
    // in llamaEngine.ts) - combining them is a future hybrid mode, not this
    // toggle pair, so turning one on turns the other off rather than
    // silently letting NPU win without saying so.
    if (value && gpuAcceleration) setGpuAcceleration(false);
    if (!value) return;
    // detectNpuDevices() has already run once (see the focus effect above),
    // so the actual per-device answer is known by the time this fires —
    // no reason to give the same generic "may not work" note to a device
    // that has already, concretely, been found to lack the chipset.
    if (npuDevices !== null && npuDevices.length === 0) {
      showAlert(
        "No NPU detected on this device",
        "This device's chipset doesn't have a supported Hexagon NPU (Qualcomm Snapdragon 8 Gen 1 or newer only). Turning this on will have no effect — inference will keep running on CPU.",
        [{ label: "OK" }]
      );
      return;
    }
    showAlert(
      "NPU Acceleration enabled",
      "Experimental. Best suited to models under 4B parameters. Takes effect the next time a model loads.",
      [{ label: "OK" }]
    );
  };

  const onToggleGpuAcceleration = (value: boolean) => {
    setGpuAcceleration(value);
    if (value && npuAcceleration) setNpuAcceleration(false);
    if (!value) return;
    if (gpuDevices !== null && gpuDevices.length === 0) {
      showAlert(
        "No supported GPU detected on this device",
        "GPU offload needs a Qualcomm Adreno 700-series GPU or newer, exposed via OpenCL. Some devices (notably Samsung/Knox builds) restrict OpenCL access even when the hardware itself supports it, which would also show up as \"not detected\" here. Turning this on will have no effect — inference will keep running on CPU.",
        [{ label: "OK" }]
      );
      return;
    }
    showAlert(
      "GPU Acceleration enabled",
      "Experimental. Currently limited to Q4_0 and Q6_K quantized models. Takes effect the next time a model loads.",
      [{ label: "OK" }]
    );
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Card>
        <Text style={styles.sectionTitle}>Performance</Text>
        <View style={styles.toggleRow}>
          <View style={styles.toggleTextWrap}>
            <Text style={styles.toggleLabel}>Lite Mode</Text>
            <Text style={styles.hint}>Reduces CPU thread usage to save battery/heat, at the cost of generation speed.</Text>
          </View>
          <Switch
            value={liteMode}
            onValueChange={onToggleLiteMode}
            trackColor={{ false: colors.border, true: colors.accent }}
            thumbColor={colors.textPrimary}
          />
        </View>
      </Card>

      <Card>
        <Text style={styles.sectionTitle}>NPU Acceleration</Text>
        <Text style={styles.hint}>
          Experimental. Offloads inference to the Hexagon NPU on supported Qualcomm chipsets (Snapdragon 8 Gen 1 and
          newer) instead of the CPU.
        </Text>
        {npuDevices !== null ? (
          <View style={styles.statusRow}>
            <Text style={styles.statusLabel}>Hexagon NPU</Text>
            <Text style={[styles.statusValue, npuDevices.length > 0 ? styles.statusValueGood : styles.statusValueBad]}>
              {npuDevices.length > 0 ? `Detected (${npuDevices.join(", ")})` : "Not detected on this device"}
            </Text>
          </View>
        ) : null}
        <View style={styles.toggleRow}>
          <View style={styles.toggleTextWrap}>
            <Text style={styles.toggleLabel}>Use NPU when available</Text>
          </View>
          <Switch
            value={npuAcceleration}
            onValueChange={onToggleNpuAcceleration}
            trackColor={{ false: colors.border, true: colors.accent }}
            thumbColor={colors.textPrimary}
          />
        </View>
      </Card>

      <Card>
        <Text style={styles.sectionTitle}>GPU Acceleration</Text>
        <Text style={styles.hint}>
          Experimental. Offloads inference to the Adreno GPU via OpenCL on supported Qualcomm chipsets (Adreno 700
          series and newer) instead of the CPU. Mutually exclusive with NPU acceleration for now.
        </Text>
        {gpuDevices !== null ? (
          <View style={styles.statusRow}>
            <Text style={styles.statusLabel}>Adreno GPU</Text>
            <Text style={[styles.statusValue, gpuDevices.length > 0 ? styles.statusValueGood : styles.statusValueBad]}>
              {/* "Not detected" is the honest default label - most devices
               * genuinely have no Adreno chipset at all, so that's the more
               * likely truth. The "may be present but blocked" nuance (seen
               * on Samsung/Knox devices) belongs in the longer hint/alert
               * copy below, not asserted in this short status line where it
               * would overclaim for the common case. */}
              {gpuDevices.length > 0 ? `Detected (${gpuDevices.join(", ")})` : "Not detected on this device"}
            </Text>
          </View>
        ) : null}
        <View style={styles.toggleRow}>
          <View style={styles.toggleTextWrap}>
            <Text style={styles.toggleLabel}>Use GPU when available</Text>
          </View>
          <Switch
            value={gpuAcceleration}
            onValueChange={onToggleGpuAcceleration}
            trackColor={{ false: colors.border, true: colors.accent }}
            thumbColor={colors.textPrimary}
          />
        </View>
      </Card>

      {batteryExempt !== null ? (
        <Card>
          <Text style={styles.sectionTitle}>Background running</Text>
          <Text style={styles.hint}>
            Android may pause downloads or inference if it decides the app is idle in the background. Exempting Trunk
            from battery optimization makes that less likely.
          </Text>
          <View style={styles.statusRow}>
            <Text style={styles.statusLabel}>Battery optimization</Text>
            <Text style={[styles.statusValue, batteryExempt ? styles.statusValueGood : styles.statusValueBad]}>
              {batteryExempt ? "Exempt" : "Not exempt"}
            </Text>
          </View>
          {!batteryExempt ? (
            <Button
              label="Disable battery optimization"
              variant="secondary"
              onPress={async () => {
                await requestBatteryOptimizationExemption();
                setBatteryExempt(await isBatteryOptimizationExempt());
              }}
            />
          ) : null}
        </Card>
      ) : null}
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
    statusRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      borderWidth: 1,
      borderColor: colors.border,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      marginBottom: spacing.sm,
    },
    statusLabel: { color: colors.textPrimary, fontSize: 12, fontWeight: "600" },
    statusValue: { fontSize: 12, fontWeight: "700" },
    statusValueGood: { color: colors.running },
    statusValueBad: { color: colors.error },
  });
}
