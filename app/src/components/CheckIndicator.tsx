import React, { useMemo } from "react";
import { StyleSheet, View } from "react-native";
import { ColorPalette } from "../theme/colors";
import { useColors } from "../theme/ThemeContext";

/** A classic checkbox look (filled square + check mark). The check is drawn
 * from two borders rotated into a "L" rather than a text glyph -- Unicode
 * "✓" renders with soft/curved strokes on most fonts and looked blurry at
 * this size. */
export function CheckIndicator({ checked }: { checked: boolean }) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <View style={[styles.box, checked && styles.boxChecked]}>
      {checked ? <View style={styles.mark} /> : null}
    </View>
  );
}

function createStyles(colors: ColorPalette) {
  return StyleSheet.create({
    box: {
      width: 20,
      height: 20,
      borderWidth: 2,
      borderColor: colors.border,
      alignItems: "center",
      justifyContent: "center",
    },
    boxChecked: { borderColor: colors.accent, backgroundColor: colors.accent },
    mark: {
      width: 10,
      height: 5,
      borderLeftWidth: 2,
      borderBottomWidth: 2,
      borderColor: colors.background,
      transform: [{ rotate: "-45deg" }],
      marginTop: -2,
    },
  });
}
