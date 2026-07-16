import React from "react";
import { View } from "react-native";

/** A flat, drawn "two overlapping sheets" copy mark, built from plain Views
 * (same technique as TrashIcon) instead of a clipboard emoji, which renders
 * as a colorful pictograph on most Android devices and clashes with the
 * flat, monochrome design language. */
export function CopyIcon({ color, size = 16 }: { color: string; size?: number }) {
  const backW = size * 0.7;
  const backH = size * 0.7;
  const frontW = size * 0.7;
  const frontH = size * 0.7;
  return (
    <View style={{ width: size, height: size }}>
      <View
        style={{
          position: "absolute",
          top: 0,
          left: size - backW,
          width: backW,
          height: backH,
          borderWidth: 1.5,
          borderColor: color,
        }}
      />
      <View
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          width: frontW,
          height: frontH,
          borderWidth: 1.5,
          borderColor: color,
        }}
      />
    </View>
  );
}
