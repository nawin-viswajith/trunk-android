// Flat, sharp-edged design system: no gradients, no border-radius. Every
// surface is a solid flat fill or a 1px flat border. Same shape in light and
// dark -- only the palette values change.
export interface ColorPalette {
  background: string;
  surface: string;
  surfaceAlt: string;
  border: string;
  textPrimary: string;
  textSecondary: string;

  cpu: string; // blue
  gpu: string; // purple, OpenCL
  npu: string; // orange, Hexagon NPU
  running: string; // green
  error: string; // red
  warning: string; // yellow
}

export const darkColors: ColorPalette = {
  background: "#0B0D10",
  surface: "#141821",
  surfaceAlt: "#1B212C",
  border: "#2A3140",
  textPrimary: "#EAEDF2",
  textSecondary: "#9AA4B2",

  cpu: "#3D7CFF",
  gpu: "#A855F7",
  npu: "#F97316",
  running: "#22C55E",
  error: "#EF4444",
  warning: "#EAB308",
};

export const lightColors: ColorPalette = {
  background: "#F5F6F8",
  surface: "#FFFFFF",
  surfaceAlt: "#ECEEF1",
  border: "#D7DBE2",
  textPrimary: "#14181F",
  textSecondary: "#5B6472",

  // Semantic accents stay the same hue across themes -- darkened slightly
  // where needed so they still meet contrast against a light background.
  cpu: "#2F63D6",
  gpu: "#9333EA",
  npu: "#EA670C",
  running: "#16A34A",
  error: "#DC2626",
  warning: "#CA8A04",
};

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
