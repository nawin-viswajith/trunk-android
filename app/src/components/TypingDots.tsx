import React, { useEffect, useMemo, useRef } from "react";
import { Animated, StyleSheet, View } from "react-native";
import { ColorPalette } from "../theme/colors";
import { useColors } from "../theme/ThemeContext";

/** Three dots bouncing in a wave while the model has been asked for a
 * response but hasn't streamed a first token back yet. */
export function TypingDots() {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const anims = useRef([new Animated.Value(0), new Animated.Value(0), new Animated.Value(0)]).current;

  useEffect(() => {
    const loops = anims.map((anim, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 120),
          Animated.timing(anim, { toValue: 1, duration: 280, useNativeDriver: true }),
          Animated.timing(anim, { toValue: 0, duration: 280, useNativeDriver: true }),
          Animated.delay((2 - i) * 120),
        ])
      )
    );
    loops.forEach((loop) => loop.start());
    return () => loops.forEach((loop) => loop.stop());
  }, [anims]);

  return (
    <View style={styles.row}>
      {anims.map((anim, i) => (
        <Animated.View
          key={i}
          style={[
            styles.dot,
            { transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [0, -4] }) }] },
          ]}
        />
      ))}
    </View>
  );
}

function createStyles(colors: ColorPalette) {
  return StyleSheet.create({
    row: { flexDirection: "row", alignItems: "center", gap: 3, paddingVertical: 3, paddingHorizontal: 2 },
    dot: { width: 4, height: 4, borderRadius: 2, backgroundColor: colors.textSecondary },
  });
}
