import React, { useMemo, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import WebView from "react-native-webview";
import { ColorPalette } from "../theme/colors";
import { useColors } from "../theme/ThemeContext";
import { KATEX_JS } from "../assets/katex/katexJs";
import { KATEX_CSS } from "../assets/katex/katexCss";

interface MathViewProps {
  latex: string;
  displayMode: boolean;
}

const DEFAULT_HEIGHT = 32;

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
  try {
    katex.render(${JSON.stringify(latex)}, document.getElementById("m"), {
      displayMode: ${displayMode ? "true" : "false"},
      throwOnError: false,
    });
  } catch (e) {
    document.getElementById("m").textContent = ${JSON.stringify(latex)};
  }
  function postHeight() {
    window.ReactNativeWebView.postMessage(String(document.body.scrollHeight));
  }
  postHeight();
  setTimeout(postHeight, 60);
  setTimeout(postHeight, 250);
</script>
</body>
</html>`;
}

/** Renders a LaTeX formula via KaTeX inside a WebView, sized to fit its own
 * content (no internal scrolling) so it can sit inline in a chat bubble's
 * message list. KaTeX/fonts are fully vendored (see src/assets/katex) -
 * nothing is fetched over the network, matching the app's on-device-only
 * requirement. */
export function MathView({ latex, displayMode }: MathViewProps) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [height, setHeight] = useState(DEFAULT_HEIGHT);
  const html = useMemo(() => buildHtml(latex, displayMode, colors.textPrimary), [latex, displayMode, colors.textPrimary]);
  const webviewRef = useRef<WebView>(null);

  return (
    <View style={[styles.wrap, displayMode && styles.wrapDisplay]}>
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
          const next = Number(event.nativeEvent.data);
          if (Number.isFinite(next) && next > 0) setHeight(next);
        }}
      />
    </View>
  );
}

function createStyles(colors: ColorPalette) {
  return StyleSheet.create({
    wrap: { marginVertical: 2 },
    wrapDisplay: { alignItems: "center" },
    webview: { backgroundColor: "transparent", width: "100%" },
  });
}
