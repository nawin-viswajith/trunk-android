import React, { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";
import { FONT_DISPLAY, FONT_LIGHT } from "../theme/fonts";

/** Shown immediately after the native splash hides, so the transition is
 * seamless (same black background + mark) — but rendered in JS so we can
 * add the wordmark text the native splash-screen plugin can't lay out.
 *
 * Two-stage entrance: the mark starts oversized and settles down to its
 * normal size, THEN the wordmark fades in — rather than everything
 * appearing at once. Plain RN Animated (no SVG) — SVG would only earn its
 * keep for path-draw/morph effects, which need real vector path data, not
 * just an upscaled PNG. */
export function BootSplash() {
  const logoScale = useRef(new Animated.Value(1.6)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.timing(logoScale, {
        toValue: 1,
        duration: 550,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(textOpacity, { toValue: 1, duration: 350, useNativeDriver: true }),
    ]).start();
  }, [logoScale, textOpacity]);

  return (
    <View style={styles.container}>
      <Animated.Image
        source={require("../../assets/splash-icon.png")}
        style={[styles.logo, { transform: [{ scale: logoScale }] }]}
        resizeMode="contain"
      />
      <Animated.Text style={[styles.title, { opacity: textOpacity }]}>Trunk</Animated.Text>
      <Animated.Text style={[styles.subtitle, { opacity: textOpacity }]}>by TuskerLabs</Animated.Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000000", alignItems: "center", justifyContent: "center" },
  logo: { width: 150, height: 150, marginBottom: 20 },
  title: { color: "#FFFFFF", fontSize: 34, fontFamily: FONT_DISPLAY, letterSpacing: 1 },
  subtitle: { color: "#A6A6A6", fontSize: 14, marginTop: 6, fontFamily: FONT_LIGHT },
});
