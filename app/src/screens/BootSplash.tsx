import React, { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";
import { FONT_DISPLAY, FONT_LIGHT } from "../theme/fonts";

/** Shown immediately after the native splash hides, so the transition is
 * seamless (same black background + mark) — but rendered in JS so we can
 * add the wordmark text the native splash-screen plugin can't lay out.
 *
 * One cohesive entrance, not a two-stage reveal: the logo and "Trunk" title
 * fade/scale in together as a single block (a big lone mark that shrinks,
 * THEN pops in a second, unrelated bit of text a beat later, reads as
 * janky) — the brand line sits fixed at the bottom of the screen instead of
 * stacked directly under the title, which is both a cleaner layout and one
 * less thing competing for attention in the main block. */
export function BootSplash() {
  const blockOpacity = useRef(new Animated.Value(0)).current;
  const blockScale = useRef(new Animated.Value(0.94)).current;
  const brandOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(blockOpacity, { toValue: 1, duration: 420, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(blockScale, { toValue: 1, duration: 420, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(brandOpacity, { toValue: 1, duration: 600, useNativeDriver: true }),
    ]).start();
  }, [blockOpacity, blockScale, brandOpacity]);

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.centerBlock, { opacity: blockOpacity, transform: [{ scale: blockScale }] }]}>
        <Animated.Image source={require("../../assets/splash-icon.png")} style={styles.logo} resizeMode="contain" />
        <Animated.Text style={styles.title}>Trunk</Animated.Text>
      </Animated.View>
      <Animated.Text style={[styles.brand, { opacity: brandOpacity }]}>by TuskerLabs</Animated.Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000000", alignItems: "center", justifyContent: "center" },
  centerBlock: { alignItems: "center" },
  logo: { width: 150, height: 150, marginBottom: 16 },
  title: { color: "#FFFFFF", fontSize: 34, fontFamily: FONT_DISPLAY, letterSpacing: 1 },
  brand: {
    position: "absolute",
    bottom: 56,
    left: 0,
    right: 0,
    textAlign: "center",
    color: "#A6A6A6",
    fontSize: 13,
    fontFamily: FONT_LIGHT,
    letterSpacing: 0.5,
  },
});
