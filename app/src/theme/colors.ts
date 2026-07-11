// Flat, sharp-edged design system: no gradients, no border-radius. Every
// surface is a solid flat fill or a 1px flat border. Same shape in light and
// dark - only the palette values change.

/** Structural/semantic colors - fixed per light/dark mode, not user
 * customizable. Status colors (running/error/warning) keep their universal
 * meaning (success/danger/caution) regardless of accent choice. */
export interface BasePalette {
  background: string;
  surface: string;
  surfaceAlt: string;
  border: string;
  textPrimary: string;
  textSecondary: string;

  running: string; // green
  error: string; // red
  warning: string; // yellow
}

/** The full palette every screen/component consumes: base colors plus the
 * user's chosen three-tone accent palette:
 * - `accent` (primary): buttons, active tab, selection state
 * - `accentSecondary`: progress/highlight/informational elements (Home
 *   "suggested model" card, the chat screen's accent stripe)
 * - `accentTertiary`: a third coordinated tone for lighter-touch accents
 *   (repo links in Hugging Face search, card border stripes)
 * Resolved by ThemeContext from BasePalette + the palette picked in Settings. */
export interface ColorPalette extends BasePalette {
  accent: string;
  accentSecondary: string;
  accentTertiary: string;
}

export const darkBase: BasePalette = {
  background: "#0B0D10",
  surface: "#141821",
  surfaceAlt: "#1B212C",
  border: "#2A3140",
  textPrimary: "#EAEDF2",
  textSecondary: "#9AA4B2",

  running: "#22C55E",
  error: "#EF4444",
  warning: "#EAB308",
};

/** True OLED black -- an alternate dark contrast level, not a separate theme.
 * background is pure black for max contrast/OLED power savings, but surface
 * needs a slight lift above it (not also pure black) or every header/card/
 * modal that relies on surface-vs-background contrast becomes invisible. */
export const darkBasePitchBlack: BasePalette = {
  background: "#000000",
  surface: "#0A0A0A",
  surfaceAlt: "#141414",
  border: "#262626",
  textPrimary: "#FFFFFF",
  textSecondary: "#A6A6A6",

  running: "#22C55E",
  error: "#EF4444",
  warning: "#EAB308",
};

export const lightBase: BasePalette = {
  background: "#F5F6F8",
  surface: "#FFFFFF",
  surfaceAlt: "#ECEEF1",
  border: "#D7DBE2",
  textPrimary: "#14181F",
  textSecondary: "#5B6472",

  running: "#16A34A",
  error: "#DC2626",
  warning: "#CA8A04",
};

export interface AccentTone {
  dark: string;
  light: string;
}

export interface AccentPreset {
  name: string;
  primary: AccentTone;
  secondary: AccentTone;
  tertiary: AccentTone;
}

// Each preset is a coordinated three-tone palette (primary/secondary/tertiary,
// Material-Design-style), each tone carrying a dark- and light-optimized
// shade so contrast holds against both backgrounds without asking the user
// to manage six colors individually.
export const ACCENT_PRESETS: AccentPreset[] = [
  {
    name: "Ocean",
    primary: { dark: "#3D7CFF", light: "#2F63D6" },
    secondary: { dark: "#22D3EE", light: "#0E7490" },
    tertiary: { dark: "#818CF8", light: "#4F46E5" },
  },
  {
    name: "Mint",
    primary: { dark: "#2DD4BF", light: "#0D9488" },
    secondary: { dark: "#22C55E", light: "#16A34A" },
    tertiary: { dark: "#A3E635", light: "#65A30D" },
  },
  {
    name: "Forest",
    primary: { dark: "#22C55E", light: "#16A34A" },
    secondary: { dark: "#A3E635", light: "#65A30D" },
    tertiary: { dark: "#EAB308", light: "#A16207" },
  },
  {
    name: "Violet",
    primary: { dark: "#A855F7", light: "#9333EA" },
    secondary: { dark: "#EC4899", light: "#DB2777" },
    tertiary: { dark: "#818CF8", light: "#4F46E5" },
  },
  {
    name: "Sunset",
    primary: { dark: "#F97316", light: "#EA670C" },
    secondary: { dark: "#EF4444", light: "#DC2626" },
    tertiary: { dark: "#EAB308", light: "#A16207" },
  },
  {
    name: "Blossom",
    primary: { dark: "#EC4899", light: "#DB2777" },
    secondary: { dark: "#C084FC", light: "#A855F7" },
    tertiary: { dark: "#818CF8", light: "#4F46E5" },
  },
  {
    // No color, just a contrast ramp -- each tone is independently tuned per
    // mode (not just re-used across dark/light) so it actually reads as three
    // distinct steps against both a near-black and a white background.
    name: "Greyscale",
    primary: { dark: "#E5E5E5", light: "#262626" },
    secondary: { dark: "#A3A3A3", light: "#525252" },
    tertiary: { dark: "#737373", light: "#8C8C8C" },
  },
];

export const DEFAULT_ACCENT_PRESET = ACCENT_PRESETS[0].name;

export function isValidHexColor(value: string): boolean {
  return /^#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})$/.test(value.trim());
}

export const radius = 0; // sharp edges everywhere, deliberately

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
} as const;

export const typography = {
  mono: "monospace",
} as const;
