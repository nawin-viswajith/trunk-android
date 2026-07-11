import React, { useEffect, useMemo, useRef } from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";
import { ColorPalette } from "../theme/colors";
import { useColors } from "../theme/ThemeContext";

const SEGMENT_WIDTH = 120;

/** For operations with no real progress signal (e.g. a local file copy via
 * expo-file-system, which doesn't expose byte-level progress) -- an honest
 * "work is happening" indicator instead of a fake percentage. */
export function IndeterminateProgressBar() {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(anim, { toValue: 1, duration: 1100, easing: Easing.linear, useNativeDriver: true })
    );
    loop.start();
    return () => loop.stop();
  }, [anim]);

  const translateX = anim.interpolate({ inputRange: [0, 1], outputRange: [-SEGMENT_WIDTH, 280] });

  return (
    <View style={styles.track}>
      <Animated.View style={[styles.fill, { transform: [{ translateX }] }]} />
    </View>
  );
}

function createStyles(colors: ColorPalette) {
  return StyleSheet.create({
    track: { height: 4, backgroundColor: colors.surfaceAlt, overflow: "hidden" },
    fill: { width: SEGMENT_WIDTH, height: 4, backgroundColor: colors.accent },
  });
}
