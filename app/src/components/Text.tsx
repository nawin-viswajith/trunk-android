import React from "react";
import { Text as RNText, StyleSheet, TextProps } from "react-native";
import { fontFamilyForWeight } from "../theme/fonts";
import { useSettingsStore } from "../state/useSettingsStore";

/** Drop-in replacement for RN's Text that defaults to the app's Urbanist
 * font - picks the correct pre-loaded weight-specific font file from
 * whatever fontWeight the caller's style already specifies (e.g.
 * fontWeight: "700" still renders bold), then clears that numeric
 * fontWeight back to "normal". Android can't resolve a custom fontFamily
 * *and* a non-normal fontWeight at the same time - it silently falls back
 * to the system default font instead of erroring, which is why this needs
 * to be explicit rather than left alone. A style that sets its own
 * fontFamily (e.g. "monospace" for filenames/stats) always wins - it's left
 * completely untouched. Subscribes to the Settings font toggle so switching
 * it applies to every Text on screen immediately. */
export function Text({ style, ...rest }: TextProps) {
  const useCustomFont = useSettingsStore((s) => s.useCustomFont);
  const flat = StyleSheet.flatten(style) ?? {};
  const resolvedFamily = flat.fontFamily ? undefined : fontFamilyForWeight(flat.fontWeight, useCustomFont);
  const override = resolvedFamily ? { fontFamily: resolvedFamily, fontWeight: "normal" as const } : null;
  return <RNText {...rest} style={[style, override]} />;
}
