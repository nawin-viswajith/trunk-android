import React from "react";
import { View } from "react-native";

/** A flat, drawn trash-can mark -- built from plain Views (same technique as
 * CheckIndicator's checkmark) instead of the bin emoji, which renders as a
 * colorful pictograph on most Android devices and clashes with the flat,
 * monochrome design language. */
export function TrashIcon({ color, size = 18 }: { color: string; size?: number }) {
  const bodyWidth = size * 0.6;
  const bodyHeight = size * 0.55;
  const lidWidth = size * 0.8;
  return (
    <View style={{ width: size, height: size, alignItems: "center" }}>
      <View style={{ width: size * 0.3, height: 2, backgroundColor: color, marginBottom: 2 }} />
      <View style={{ width: lidWidth, height: 2, backgroundColor: color }} />
      <View
        style={{
          width: bodyWidth,
          height: bodyHeight,
          borderWidth: 1.5,
          borderTopWidth: 0,
          borderColor: color,
          marginTop: 1,
        }}
      />
    </View>
  );
}
