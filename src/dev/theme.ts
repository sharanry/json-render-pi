import type { JsonRenderTheme } from "../renderer.ts";

const palette = {
  text: "#e5e7eb",
  accent: "#67e8f9",
  muted: "#94a3b8",
  dim: "#64748b",
  success: "#4ade80",
  warning: "#facc15",
  error: "#fb7185",
};

function foreground(hex: string, text: string): string {
  const [red, green, blue] = hex.slice(1).match(/../g)!.map((value) => Number.parseInt(value, 16));
  return `\x1b[38;2;${red};${green};${blue}m${text}\x1b[39m`;
}

/** ANSI theme shared by terminal, snapshot, and browser previews. */
export const ansiTheme: JsonRenderTheme = {
  accent: (text) => foreground(palette.accent, text),
  text: (text) => foreground(palette.text, text),
  muted: (text) => foreground(palette.muted, text),
  dim: (text) => foreground(palette.dim, text),
  success: (text) => foreground(palette.success, text),
  warning: (text) => foreground(palette.warning, text),
  error: (text) => foreground(palette.error, text),
  bold: (text) => `\x1b[1m${text}\x1b[22m`,
  italic: (text) => `\x1b[3m${text}\x1b[23m`,
};

export const plainTheme: JsonRenderTheme = {
  accent: (text) => text,
  text: (text) => text,
  muted: (text) => text,
  dim: (text) => text,
  success: (text) => text,
  warning: (text) => text,
  error: (text) => text,
  bold: (text) => text,
  italic: (text) => text,
};
