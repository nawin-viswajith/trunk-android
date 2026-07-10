// Flat, sharp-edged design system: no gradients, no border-radius. Every
// surface is a solid flat fill or a 1px flat border.
export const colors = {
  background: "#0B0D10",
  surface: "#141821",
  surfaceAlt: "#1B212C",
  border: "#2A3140",
  textPrimary: "#EAEDF2",
  textSecondary: "#9AA4B2",

  cpu: "#3D7CFF", // blue
  gpu: "#A855F7", // purple, OpenCL
  npu: "#F97316", // orange, Hexagon NPU
  running: "#22C55E", // green
  error: "#EF4444", // red
  warning: "#EAB308", // yellow
} as const;

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
