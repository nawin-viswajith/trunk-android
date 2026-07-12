import React from "react";
import { TextInput as RNTextInput, StyleSheet, TextInputProps } from "react-native";
import { fontFamilyForWeight } from "../theme/fonts";
import { useSettingsStore } from "../state/useSettingsStore";

/** Drop-in replacement for RN's TextInput that defaults to the app's
 * Urbanist font — see Text.tsx for why the weight has to be resolved to a
 * specific pre-loaded font file and the numeric fontWeight cleared back to
 * "normal" afterward. */
export function TextInput({ style, ...rest }: TextInputProps) {
  const useCustomFont = useSettingsStore((s) => s.useCustomFont);
  const flat = StyleSheet.flatten(style) ?? {};
  const resolvedFamily = flat.fontFamily ? undefined : fontFamilyForWeight(flat.fontWeight, useCustomFont);
  const override = resolvedFamily ? { fontFamily: resolvedFamily, fontWeight: "normal" as const } : null;
  return <RNTextInput {...rest} style={[style, override]} />;
}
