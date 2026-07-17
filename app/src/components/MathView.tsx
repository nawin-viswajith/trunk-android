import React, { useMemo, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { MathJaxSvg } from "react-native-mathjax-html-to-svg";
import { Text } from "./Text";
import { ColorPalette } from "../theme/colors";
import { useColors } from "../theme/ThemeContext";

interface MathViewProps {
  latex: string;
  displayMode: boolean;
}

/** Renders a LaTeX formula via MathJax, converted ahead-of-time (pure JS, no
 * DOM) to an SVG string and drawn with react-native-svg - no WebView. The
 * previous WebView+KaTeX approach rendered some formulas (e.g. \sqrt, which
 * KaTeX draws as SVG path glyphs) as blank boxes on real Android devices,
 * and a WebView per math block in a scrolling chat list is its own memory
 * problem; this component sidesteps both by never spinning up a WebView. A
 * render that throws (e.g. a macro MathJax doesn't support) falls back to
 * raw LaTeX text, and a toggle lets the user switch to raw text regardless. */
export function MathView({ latex, displayMode }: MathViewProps) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [showRaw, setShowRaw] = useState(false);
  const [renderFailed, setRenderFailed] = useState(false);

  const displayingRaw = showRaw || renderFailed;

  return (
    <View style={[styles.wrap, displayMode && styles.wrapDisplay]}>
      {displayingRaw ? (
        <Text style={[styles.rawText, { color: colors.textPrimary }]} selectable>
          {latex}
        </Text>
      ) : (
        <MathErrorBoundary onError={() => setRenderFailed(true)}>
          <MathJaxSvg fontSize={17} color={colors.textPrimary} fontCache={false}>
            {latex}
          </MathJaxSvg>
        </MathErrorBoundary>
      )}
      <Pressable onPress={() => setShowRaw((v) => !v)} style={styles.toggle} hitSlop={8}>
        <Text style={styles.toggleText}>{displayingRaw && !renderFailed ? "Show rendered" : renderFailed ? "Raw LaTeX" : "Show raw"}</Text>
      </Pressable>
    </View>
  );
}

class MathErrorBoundary extends React.Component<{ onError: () => void; children: React.ReactNode }> {
  state = { errored: false };
  static getDerivedStateFromError() {
    return { errored: true };
  }
  componentDidCatch() {
    this.props.onError();
  }
  render() {
    if (this.state.errored) return null;
    return this.props.children;
  }
}

function createStyles(colors: ColorPalette) {
  return StyleSheet.create({
    wrap: { marginVertical: 2 },
    wrapDisplay: { alignItems: "center" },
    rawText: { fontFamily: "monospace", fontSize: 13 },
    toggle: { alignSelf: "flex-start", marginTop: 2 },
    toggleText: { color: colors.textSecondary, fontSize: 10, textDecorationLine: "underline" },
  });
}
