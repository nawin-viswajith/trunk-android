import React, { useMemo, useRef, useState } from "react";
import { PanResponder, StyleSheet, View } from "react-native";
import { ColorPalette } from "../theme/colors";
import { useColors } from "../theme/ThemeContext";

interface GradientSliderProps {
  value: number; // 0-1
  onChange: (value: number) => void;
  stops: string[];
}

const TRACK_HEIGHT = 28;
const THUMB_SIZE = 22;

export function GradientSlider({ value, onChange, stops }: GradientSliderProps) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [trackWidth, setTrackWidth] = useState(0);
  const trackWidthRef = useRef(0);
  const trackPageXRef = useRef(0);
  const trackRef = useRef<View>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  function measureTrack() {
    trackRef.current?.measure((_x, _y, width, _height, pageX) => {
      trackWidthRef.current = width;
      trackPageXRef.current = pageX;
      setTrackWidth(width);
    });
  }

  function updateFromPageX(pageX: number) {
    const width = trackWidthRef.current;
    if (width <= 0) return;
    const x = pageX - trackPageXRef.current;
    onChangeRef.current(Math.min(1, Math.max(0, x / width)));
  }

  // Lives inside a ScrollView, so the responder must be captured aggressively
  // (capture-phase handlers + refusing termination) or the ScrollView steals
  // the gesture partway through a horizontal drag.
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onStartShouldSetPanResponderCapture: () => true,
        onMoveShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponderCapture: () => true,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: (evt) => {
          measureTrack();
          updateFromPageX(evt.nativeEvent.pageX);
        },
        onPanResponderMove: (evt) => updateFromPageX(evt.nativeEvent.pageX),
      }),
    []
  );

  return (
    <View ref={trackRef} style={styles.track} onLayout={measureTrack} {...panResponder.panHandlers}>
      <View style={styles.gradientRow}>
        {stops.map((color, i) => (
          <View key={i} style={[styles.segment, { backgroundColor: color }]} />
        ))}
      </View>
      {trackWidth > 0 ? (
        <View
          pointerEvents="none"
          style={[
            styles.thumb,
            { left: Math.min(trackWidth - THUMB_SIZE, Math.max(0, value * trackWidth - THUMB_SIZE / 2)) },
          ]}
        />
      ) : null}
    </View>
  );
}

function createStyles(colors: ColorPalette) {
  return StyleSheet.create({
    track: {
      height: TRACK_HEIGHT,
      justifyContent: "center",
      borderWidth: 1,
      borderColor: colors.border,
    },
    gradientRow: { flexDirection: "row", height: "100%" },
    segment: { flex: 1 },
    thumb: {
      position: "absolute",
      width: THUMB_SIZE,
      height: THUMB_SIZE,
      borderRadius: THUMB_SIZE / 2,
      borderWidth: 2,
      borderColor: colors.textPrimary,
      backgroundColor: colors.background,
    },
  });
}
