import {
  useFonts,
  Urbanist_300Light,
  Urbanist_400Regular,
  Urbanist_600SemiBold,
  Urbanist_700Bold,
} from "@expo-google-fonts/urbanist";
import { Iceland_400Regular } from "@expo-google-fonts/iceland";

export const FONT_LIGHT = "Urbanist_300Light";
export const FONT_REGULAR = "Urbanist_400Regular";
export const FONT_SEMIBOLD = "Urbanist_600SemiBold";
export const FONT_BOLD = "Urbanist_700Bold";
/** Display face for the "Trunk" wordmark only (BootSplash) — not part of
 * fontFamilyForWeight's mapping, never used for body/UI text. */
export const FONT_DISPLAY = "Iceland_400Regular";

export function useAppFonts(): boolean {
  const [loaded] = useFonts({
    Urbanist_300Light,
    Urbanist_400Regular,
    Urbanist_600SemiBold,
    Urbanist_700Bold,
    Iceland_400Regular,
  });
  return loaded;
}

/** Android can't synthesize bold/semibold weights on a custom TTF the way it
 * does for system fonts, so every weight used anywhere in the app needs its
 * own explicit pre-loaded font file, chosen here from whatever fontWeight a
 * style already specifies. Returns undefined (platform default) when the
 * user has turned the custom font off in Settings. */
export function fontFamilyForWeight(weight: string | number | undefined, useCustomFont: boolean): string | undefined {
  if (!useCustomFont) return undefined;
  const w = String(weight ?? "");
  if (w === "700" || w === "bold") return FONT_BOLD;
  if (w === "600") return FONT_SEMIBOLD;
  return FONT_REGULAR;
}
