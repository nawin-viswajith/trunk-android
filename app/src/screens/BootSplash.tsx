import React, { useEffect, useRef } from "react";
import { Animated, StyleSheet, View } from "react-native";
import { useFonts, Iceland_400Regular } from "@expo-google-fonts/iceland";
import { Urbanist_300Light } from "@expo-google-fonts/urbanist";

// Matches app.json's expo-splash-screen "imageWidth": 220 exactly - this
// screen takes over the instant the native Android splash (which renders
// the same PNG at that width, via windowSplashScreenAnimatedIcon) hides, so
// any size mismatch here is a visible shrink/grow jump in the logo despite
// neither side individually animating anything wrong.
const LOGO_SIZE = 220;

/** Shown immediately after the native splash hides, so the transition is
 * seamless (same black background + mark + size). The logo never moves or
 * rescales here - it was already full-size in the native splash - this
 * component's only job is to bring in the wordmark alongside it as one
 * settled unit, not as a second, separate reveal a beat later.
 *
 * The "Trunk" title needs the Iceland display font specifically, which is
 * NOT guaranteed loaded yet: App.tsx shows this exact component precisely
 * because the app's fonts (Iceland included) are still loading - that's
 * its trigger condition. Waiting on the app-wide font bundle here would be
 * circular, so this loads just the one font it needs, independently and
 * far faster than the full Urbanist+Iceland set, and holds the title back
 * (rather than flashing it in the wrong font) until that resolves. */
export function BootSplash() {
  const [fontsReady] = useFonts({ Iceland_400Regular, Urbanist_300Light });
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }).start();
  }, [opacity]);

  return (
    <View style={styles.container}>
      <View style={styles.centerBlock}>
        <Animated.Image source={require("../../assets/splash-icon.png")} style={styles.logo} resizeMode="contain" />
        {fontsReady ? <Animated.Text style={[styles.title, { opacity }]}>Trunk</Animated.Text> : null}
      </View>
      {fontsReady ? <Animated.Text style={[styles.brand, { opacity }]}>by TuskerLabs</Animated.Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000000", alignItems: "center", justifyContent: "center" },
  centerBlock: { alignItems: "center" },
  logo: { width: LOGO_SIZE, height: LOGO_SIZE, marginBottom: 16 },
  title: { color: "#FFFFFF", fontSize: 34, fontFamily: "Iceland_400Regular", letterSpacing: 1 },
  brand: {
    position: "absolute",
    bottom: 56,
    left: 0,
    right: 0,
    textAlign: "center",
    color: "#A6A6A6",
    fontSize: 13,
    fontFamily: "Urbanist_300Light",
    letterSpacing: 0.5,
  },
});
