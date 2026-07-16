import React from "react";
import { View } from "react-native";

/** A flat, drawn pencil mark (angled body + tip), built from plain Views
 * (same technique as TrashIcon/CopyIcon) instead of a pencil emoji, which
 * renders as a colorful pictograph on most Android devices and clashes with
 * the flat, monochrome design language. */
export function PencilIcon({ color, size = 16 }: { color: string; size?: number }) {
  const bodyLength = size * 0.85;
  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <View
        style={{
          width: bodyLength,
          height: size * 0.22,
          backgroundColor: color,
          transform: [{ rotate: "-45deg" }],
        }}
      />
    </View>
  );
}
