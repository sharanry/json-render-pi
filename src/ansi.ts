/** Browser-safe ANSI-aware terminal text helpers. */

const graphemes = new Intl.Segmenter(undefined, { granularity: "grapheme" });
const ANSI = /\x1b\[[0-?]*[ -/]*[@-~]|\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)|\x1b_[^\x07\x1b]*(?:\x07|\x1b\\)/g;
const ANSI_AT_START = /^(?:\x1b\[[0-?]*[ -/]*[@-~]|\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)|\x1b_[^\x07\x1b]*(?:\x07|\x1b\\))/;

export function visibleWidth(text: string): number {
  let width = 0;
  for (const { segment } of graphemes.segment(text.replace(ANSI, "").replace(/\t/g, "   "))) {
    width += graphemeWidth(segment);
  }
  return width;
}

export function truncateToWidth(text: string, width: number, ellipsis = "..."): string {
  if (width <= 0) return "";
  if (visibleWidth(text) <= width) return text;
  const suffix = truncatePlain(ellipsis, width);
  const target = Math.max(0, width - visibleWidth(suffix));
  return `${truncatePlain(text, target)}\x1b[0m${suffix}\x1b[0m`;
}

export function wrapTextWithAnsi(text: string, width: number): string[] {
  if (!text) return [""];
  const safeWidth = Math.max(1, width);
  return text.split("\n").flatMap((line) => wrapLine(line, safeWidth));
}

function wrapLine(line: string, width: number): string[] {
  if (visibleWidth(line) <= width) return [line];
  const tokens = line.match(/\s+|\S+/g) ?? [""];
  const lines: string[] = [];
  let current = "";

  for (const token of tokens) {
    const candidate = current + token;
    if (visibleWidth(candidate) <= width) {
      current = candidate;
      continue;
    }
    if (current.trimEnd()) lines.push(current.trimEnd());
    current = token.trimStart();
    while (visibleWidth(current) > width) {
      const part = truncatePlain(current, width);
      lines.push(part);
      current = dropVisiblePrefix(current, visibleWidth(part));
    }
  }
  if (current || lines.length === 0) lines.push(current.trimEnd());
  return lines;
}

function truncatePlain(text: string, width: number): string {
  let output = "";
  let used = 0;
  let rest = text;
  while (rest) {
    const ansi = rest.match(ANSI_AT_START)?.[0];
    if (ansi) {
      output += ansi;
      rest = rest.slice(ansi.length);
      continue;
    }
    const segment = graphemes.segment(rest)[Symbol.iterator]().next().value?.segment as string | undefined;
    if (!segment) break;
    const segmentWidth = graphemeWidth(segment);
    if (used + segmentWidth > width) break;
    output += segment;
    used += segmentWidth;
    rest = rest.slice(segment.length);
  }
  return output;
}

function dropVisiblePrefix(text: string, width: number): string {
  let rest = text;
  let dropped = 0;
  while (rest && dropped < width) {
    const ansi = rest.match(ANSI_AT_START)?.[0];
    if (ansi) {
      rest = rest.slice(ansi.length);
      continue;
    }
    const segment = graphemes.segment(rest)[Symbol.iterator]().next().value?.segment as string | undefined;
    if (!segment) break;
    dropped += graphemeWidth(segment);
    rest = rest.slice(segment.length);
  }
  return rest;
}

function graphemeWidth(segment: string): number {
  if (/^[\p{Mark}\p{Control}\p{Default_Ignorable_Code_Point}]+$/u.test(segment)) return 0;
  const codePoint = segment.codePointAt(0) ?? 0;
  if (
    codePoint >= 0x1100 && (
      codePoint <= 0x115f || codePoint === 0x2329 || codePoint === 0x232a ||
      (codePoint >= 0x2e80 && codePoint <= 0xa4cf) ||
      (codePoint >= 0xac00 && codePoint <= 0xd7a3) ||
      (codePoint >= 0xf900 && codePoint <= 0xfaff) ||
      (codePoint >= 0xfe10 && codePoint <= 0xfe6f) ||
      (codePoint >= 0xff01 && codePoint <= 0xff60) ||
      (codePoint >= 0xffe0 && codePoint <= 0xffe6) ||
      codePoint >= 0x1f000
    )
  ) return 2;
  return 1;
}
