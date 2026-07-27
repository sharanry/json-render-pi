import { Resvg } from "@resvg/resvg-js";
import { visibleWidth } from "@earendil-works/pi-tui";

import type { JsonRenderTheme } from "../renderer.ts";

export interface SnapshotOptions {
  columns: number;
  title?: string;
  fontSize?: number;
  lineHeight?: number;
}

const palette = {
  background: "#111827",
  surface: "#18212f",
  border: "#334155",
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

/** ANSI theme used by the standalone terminal preview and snapshot parser. */
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

export function renderSnapshotSvg(lines: readonly string[], options: SnapshotOptions): string {
  const fontSize = options.fontSize ?? 14;
  const lineHeight = options.lineHeight ?? 20;
  const characterWidth = fontSize * 0.61;
  const horizontalPadding = 24;
  const titleHeight = options.title ? 34 : 10;
  const width = Math.ceil(options.columns * characterWidth + horizontalPadding * 2);
  const height = Math.ceil(lines.length * lineHeight + titleHeight + 24);
  const contentY = titleHeight + 14;

  const title = options.title
    ? `<text x="${horizontalPadding}" y="23" fill="${palette.muted}" font-family="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" font-size="12" font-weight="600">${escapeXml(options.title)}</text>`
    : "";
  const renderedLines = lines.map((line, index) =>
    renderLineFragments(line, horizontalPadding, contentY + index * lineHeight, fontSize, characterWidth),
  ).join("\n");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect width="${width}" height="${height}" rx="12" fill="${palette.background}"/>
  <rect x="8" y="8" width="${width - 16}" height="${height - 16}" rx="8" fill="${palette.surface}" stroke="${palette.border}"/>
  ${title}
  ${renderedLines}
</svg>`;
}

export async function renderSnapshotPng(lines: readonly string[], options: SnapshotOptions): Promise<Buffer> {
  const svg = renderSnapshotSvg(lines, options);
  const renderer = new Resvg(svg, {
    fitTo: { mode: "original" },
    font: { loadSystemFonts: true },
  });
  return Buffer.from(renderer.render().asPng());
}

interface AnsiState {
  color: string;
  bold: boolean;
  italic: boolean;
}

interface StyledRun {
  text: string;
  state: AnsiState;
}

function renderLineFragments(
  input: string,
  startX: number,
  y: number,
  fontSize: number,
  characterWidth: number,
): string {
  let cell = 0;
  const fragments: string[] = [];
  for (const run of ansiToRuns(input)) {
    for (const token of run.text.split(/(\s+)/)) {
      if (!token) continue;
      if (/^\s+$/.test(token)) {
        cell += visibleWidth(token);
        continue;
      }
      const attributes = [
        `fill="${run.state.color}"`,
        run.state.bold ? 'font-weight="700"' : "",
        run.state.italic ? 'font-style="italic"' : "",
      ].filter(Boolean).join(" ");
      const x = startX + cell * characterWidth;
      fragments.push(`<text x="${x.toFixed(2)}" y="${y}" data-cell="${cell}" ${attributes} font-family="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" font-size="${fontSize}">${escapeXml(token)}</text>`);
      cell += visibleWidth(token);
    }
  }
  return fragments.join("");
}

function ansiToRuns(input: string): StyledRun[] {
  const state: AnsiState = { color: palette.text, bold: false, italic: false };
  const runs: StyledRun[] = [];
  const pattern = /\x1b\[([0-9;]*)m/g;
  let cursor = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(input))) {
    if (match.index > cursor) runs.push({ text: input.slice(cursor, match.index), state: { ...state } });
    applySgr(match[1] ?? "", state);
    cursor = pattern.lastIndex;
  }
  if (cursor < input.length) runs.push({ text: input.slice(cursor), state: { ...state } });
  return runs;
}

function applySgr(sequence: string, state: AnsiState): void {
  const codes = (sequence || "0").split(";").map(Number);
  for (let index = 0; index < codes.length; index += 1) {
    const code = codes[index];
    if (code === 0) {
      state.color = palette.text;
      state.bold = false;
      state.italic = false;
    } else if (code === 1) state.bold = true;
    else if (code === 22) state.bold = false;
    else if (code === 3) state.italic = true;
    else if (code === 23) state.italic = false;
    else if (code === 39) state.color = palette.text;
    else if (code === 38 && codes[index + 1] === 2) {
      const red = codes[index + 2] ?? 229;
      const green = codes[index + 3] ?? 231;
      const blue = codes[index + 4] ?? 235;
      state.color = `rgb(${red},${green},${blue})`;
      index += 4;
    }
  }
}

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}
