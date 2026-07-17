import React, { useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import WebView from "react-native-webview";
import { Text } from "./Text";
import { ColorPalette, spacing } from "../theme/colors";
import { useColors } from "../theme/ThemeContext";
import { KATEX_JS } from "../assets/katex/katexJs";
import { KATEX_CSS } from "../assets/katex/katexCss";

interface MathViewProps {
  latex: string;
  displayMode: boolean;
}

const DEFAULT_HEIGHT = 32;
// If the WebView never reports back (katex/fonts failed to load, the
// content-script didn't run at all, etc.) there's no other signal that the
// render actually happened - fall back to showing raw LaTeX after this
// timeout so the box is never left silently blank forever.
const RENDER_TIMEOUT_MS = 1500;

type RenderStatus = "pending" | "rendered" | "failed";

function buildHtml(latex: string, displayMode: boolean, textColor: string): string {
  // KaTeX itself is bundled (KATEX_JS/KATEX_CSS, vendored offline assets -
  // no CDN, matching the app's fully-on-device requirement). The source is
  // passed through JSON.stringify so any backslash/quote/newline in the
  // LaTeX round-trips into the inline <script> as a valid JS string literal.
  return `<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
<style>${KATEX_CSS}</style>
<style>
  html, body { margin: 0; padding: 0; background: transparent; }
  #m { color: ${textColor}; font-size: 17px; padding: 2px 0; }
  .katex-display { margin: 0; }
</style>
</head>
<body>
<div id="m"></div>
<script>${KATEX_JS}</script>
<script>
  function post(type, data) {
    window.ReactNativeWebView.postMessage(JSON.stringify({ type: type, data: data }));
  }
  function renderMath() {
    try {
      if (typeof katex === "undefined") { post("error", "katex not loaded"); return; }
      katex.render(${JSON.stringify(latex)}, document.getElementById("m"), {
        displayMode: ${displayMode ? "true" : "false"},
        throwOnError: false,
      });
      // katex sets throwOnError:false, so a parse error still renders
      // (as its own error-styled span) rather than leaving #m empty - only
      // a genuinely empty result after a real render attempt counts as
      // "nothing to show" from this app's point of view.
      var ok = document.getElementById("m").childNodes.length > 0;
      post(ok ? "rendered" : "error", ok ? null : "empty render output");
    } catch (e) {
      post("error", String(e && e.message || e));
    }
    post("height", document.body.scrollHeight);
  }
  renderMath();
  setTimeout(function () { post("height", document.body.scrollHeight); }, 60);
  setTimeout(function () { post("height", document.body.scrollHeight); }, 250);
</script>
</body>
</html>`;
}

/** Renders a LaTeX formula via KaTeX inside a WebView, sized to fit its own
 * content (no internal scrolling) so it can sit inline in a chat bubble's
 * message list. KaTeX/fonts are fully vendored (see src/assets/katex) -
 * nothing is fetched over the network, matching the app's on-device-only
 * requirement.
 *
 * The WebView reports back whether the render actually produced anything
 * (see the postMessage calls in buildHtml) rather than assuming success -
 * on a real device this has been observed rendering blank with no thrown
 * error, so silence is treated as failure once RENDER_TIMEOUT_MS elapses.
 * Either an explicit failure or a timeout falls back to plain raw-LaTeX
 * text, and a small toggle lets the user switch to raw text even when
 * rendering did succeed (useful to copy the source or sanity-check it). */
export function MathView({ latex, displayMode }: MathViewProps) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [height, setHeight] = useState(DEFAULT_HEIGHT);
  const [status, setStatus] = useState<RenderStatus>("pending");
  const [showRaw, setShowRaw] = useState(false);
  const html = useMemo(() => buildHtml(latex, displayMode, colors.textPrimary), [latex, displayMode, colors.textPrimary]);
  const webviewRef = useRef<WebView>(null);
  const timedOutRef = useRef(false);

  React.useEffect(() => {
    timedOutRef.current = false;
    const timer = setTimeout(() => {
      timedOutRef.current = true;
      setStatus((prev) => (prev === "pending" ? "failed" : prev));
    }, RENDER_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [html]);

  const renderFailed = status === "failed";
  const displayingRaw = showRaw || renderFailed;

  return (
    <View style={[styles.wrap, displayMode && styles.wrapDisplay]}>
      {displayingRaw ? (
        <Text style={[styles.rawText, { color: colors.textPrimary }]} selectable>
          {latex}
        </Text>
      ) : (
        <WebView
          ref={webviewRef}
          originWhitelist={["*"]}
          source={{ html }}
          style={[styles.webview, { height }]}
          scrollEnabled={false}
          overScrollMode="never"
          showsVerticalScrollIndicator={false}
          showsHorizontalScrollIndicator={false}
          setSupportMultipleWindows={false}
          onMessage={(event) => {
            let parsed: { type: string; data: unknown } | null = null;
            try {
              parsed = JSON.parse(event.nativeEvent.data);
            } catch {
              return;
            }
            if (!parsed) return;
            if (parsed.type === "height") {
              const next = Number(parsed.data);
              if (Number.isFinite(next) && next > 0) setHeight(next);
            } else if (parsed.type === "rendered" && !timedOutRef.current) {
              setStatus("rendered");
            } else if (parsed.type === "error") {
              setStatus("failed");
            }
          }}
        />
      )}
      <Pressable onPress={() => setShowRaw((v) => !v)} style={styles.toggle} hitSlop={8}>
        <Text style={styles.toggleText}>{displayingRaw && !renderFailed ? "Show rendered" : renderFailed ? "Raw LaTeX" : "Show raw"}</Text>
      </Pressable>
    </View>
  );
}

function createStyles(colors: ColorPalette) {
  return StyleSheet.create({
    wrap: { marginVertical: 2 },
    wrapDisplay: { alignItems: "center" },
    webview: { backgroundColor: "transparent", width: "100%" },
    rawText: { fontFamily: "monospace", fontSize: 13 },
    toggle: { alignSelf: "flex-start", marginTop: 2 },
    toggleText: { color: colors.textSecondary, fontSize: 10, textDecorationLine: "underline" },
  });
}
