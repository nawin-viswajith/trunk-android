import { StyleSheet } from "react-native";
import { ColorPalette } from "./colors";

/** Shared container shape used by every screen -- the title/header row
 * itself lives in <ScreenHeader>; this just keeps the background/flex
 * consistent so it can't drift screen-by-screen. */
export function createScreenStyles(colors: ColorPalette) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
  });
}
