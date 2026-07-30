import {
  truncateToWidth,
  visibleWidth,
  wrapTextWithAnsi,
} from "./ansi.ts";

import type { JsonRenderElement, JsonRenderSpec } from "./spec.ts";

/** The semantic subset of Pi's theme API used by the adapter. */
export interface JsonRenderTheme {
  accent(text: string): string;
  text(text: string): string;
  muted(text: string): string;
  dim(text: string): string;
  success(text: string): string;
  warning(text: string): string;
  error(text: string): string;
  bold(text: string): string;
  italic(text: string): string;
}

const SPARK_BLOCKS = ["▁", "▂", "▃", "▄", "▅", "▆", "▇", "█"];

/** Render a validated JSON UI with parent-aware widths and ANSI-safe wrapping. */
export function renderSpec(spec: JsonRenderSpec, width: number, theme: JsonRenderTheme): string[] {
  const safeWidth = Math.max(1, width);
  return renderElement(spec.root, spec, safeWidth, theme, new Set()).map((line) =>
    truncateToWidth(line, safeWidth, ""),
  );
}

function renderElement(
  id: string,
  spec: JsonRenderSpec,
  width: number,
  theme: JsonRenderTheme,
  stack: Set<string>,
): string[] {
  const element = spec.elements[id];
  if (!element) return [theme.error(`[Missing element: ${id}]`)];
  if (stack.has(id)) return [theme.error(`[Circular element reference: ${id}]`)];

  stack.add(id);
  let lines: string[];
  if (element.type === "Box") {
    lines = renderBox(element, spec, width, theme, stack);
  } else if (element.type === "Card") {
    lines = renderCard(element, spec, width, theme, stack);
  } else {
    lines = renderLeaf(element, width, theme);
  }
  stack.delete(id);
  return lines;
}

function renderBox(
  element: Extract<JsonRenderElement, { type: "Box" }>,
  spec: JsonRenderSpec,
  width: number,
  theme: JsonRenderTheme,
  stack: Set<string>,
): string[] {
  const padding = positiveInt(element.props.padding, 0);
  const isRow = element.props.flexDirection === "row";
  const gap = positiveInt(element.props.gap, isRow ? 3 : 0);
  const contentWidth = Math.max(1, width - padding * 2);

  if (isRow) {
    const count = Math.max(1, element.children.length);
    const available = Math.max(count, contentWidth - gap * (count - 1));
    const baseWidth = Math.max(1, Math.floor(available / count));
    let remainder = Math.max(0, available - baseWidth * count);
    const widths = element.children.map(() => baseWidth + (remainder-- > 0 ? 1 : 0));
    const blocks = element.children.map((child, index) =>
      renderElement(child, spec, widths[index]!, theme, stack),
    );
    const height = Math.max(0, ...blocks.map((block) => block.length));
    return Array.from({ length: height }, (_, row) => {
      const columns = blocks.map((block, index) => {
        const line = block[row] ?? "";
        return index === blocks.length - 1 ? line : padToWidth(line, widths[index]!);
      });
      return `${" ".repeat(padding)}${columns.join(" ".repeat(gap))}`;
    });
  }

  const blocks = element.children.map((child) =>
    renderElement(child, spec, contentWidth, theme, stack).map((line) => `${" ".repeat(padding)}${line}`),
  );
  return joinVertical(blocks, gap);
}

function renderCard(
  element: Extract<JsonRenderElement, { type: "Card" }>,
  spec: JsonRenderSpec,
  width: number,
  theme: JsonRenderTheme,
  stack: Set<string>,
): string[] {
  if (width < 8) {
    return element.children.flatMap((child) => renderElement(child, spec, width, theme, stack));
  }

  const padding = positiveInt(element.props.padding, 1);
  const frameWidth = width - 4;
  const childWidth = Math.max(1, frameWidth - padding * 2);
  const body = element.children.flatMap((child) =>
    renderElement(child, spec, childWidth, theme, stack),
  );
  const title = stringValue(element.props.title);
  const header = title ? `─ ${truncateToWidth(title, Math.max(1, width - 6), "…")} ` : "";
  const top = `┌${header}${"─".repeat(Math.max(0, width - 2 - visibleWidth(header)))}┐`;
  const rows = (body.length > 0 ? body : [""]).map((line) => {
    const content = `${" ".repeat(padding)}${line}`;
    const rightPadding = Math.max(0, frameWidth - visibleWidth(content) - padding);
    return `│ ${content}${" ".repeat(rightPadding + padding)} │`;
  });
  return [theme.accent(top), ...rows, theme.accent(`└${"─".repeat(width - 2)}┘`)];
}

function renderLeaf(element: Exclude<JsonRenderElement, { type: "Box" | "Card" }>, width: number, theme: JsonRenderTheme): string[] {
  const props = element.props as Record<string, unknown>;
  switch (element.type) {
    case "Text":
      return wrap(styleText(stringProp(props, "text"), props, theme), width);
    case "Heading":
      return wrap(renderHeading(props, theme), width);
    case "Divider":
      return [renderDivider(props, width, theme)];
    case "Badge":
      return [theme.bold(styleForVariant(stringProp(props, "variant", "default"), ` ${stringProp(props, "label")} `, theme))];
    case "ProgressBar":
      return [renderProgress(props, width, theme)];
    case "Sparkline":
      return [renderSparkline(props, width, theme)];
    case "BarChart":
      return renderBarChart(props, width, theme);
    case "Table":
      return renderTable(props, width, theme);
    case "List":
      return renderList(props, width, theme);
    case "KeyValue":
      return renderKeyValue(props, width, theme);
    case "StatusLine":
      return renderStatusLine(props, width, theme);
    case "Metric":
      return renderMetric(props, width, theme);
    case "Callout":
      return renderCallout(props, width, theme);
  }
}

function renderHeading(props: Record<string, unknown>, theme: JsonRenderTheme): string {
  const text = stringProp(props, "text");
  switch (stringProp(props, "level", "h2")) {
    case "h1": return `${theme.accent("▰")} ${theme.bold(theme.accent(text))}`;
    case "h3": return `${theme.accent("◆")} ${theme.bold(text)}`;
    case "h4": return `${theme.muted("›")} ${theme.bold(theme.muted(text))}`;
    default: return theme.bold(text);
  }
}

function renderDivider(props: Record<string, unknown>, width: number, theme: JsonRenderTheme): string {
  const char = Array.from(stringProp(props, "character", "─"))[0] ?? "─";
  const desiredWidth = Math.min(positiveInt(props.width, width), width);
  const title = stringProp(props, "title");
  if (!title) return theme.muted(char.repeat(desiredWidth));
  const safeTitle = truncateToWidth(title, Math.max(1, desiredWidth - 4), "…");
  const remaining = Math.max(0, desiredWidth - visibleWidth(safeTitle) - 2);
  const left = Math.floor(remaining / 2);
  const line = `${char.repeat(left)} ${safeTitle} ${char.repeat(remaining - left)}`;
  return props.dimColor === true ? theme.dim(line) : theme.muted(line);
}

function renderProgress(props: Record<string, unknown>, width: number, theme: JsonRenderTheme): string {
  const label = stringProp(props, "label");
  const progress = clampNumber(props.progress, 0, 1, 0);
  const requested = positiveInt(props.width, 30);
  const fixedWidth = (label ? visibleWidth(label) + 1 : 0) + 5;
  const barWidth = Math.max(1, Math.min(requested, width - fixedWidth));
  const filled = Math.round(progress * barWidth);
  const color = themeColor(stringProp(props, "color", "green"), theme);
  return `${label ? `${label} ` : ""}${color("█".repeat(filled))}${theme.dim("░".repeat(barWidth - filled))} ${theme.dim(`${Math.round(progress * 100)}%`)}`;
}

function renderSparkline(props: Record<string, unknown>, width: number, theme: JsonRenderTheme): string {
  const source = numberArray(props.data);
  const label = stringProp(props, "label");
  const available = Math.max(1, Math.min(positiveInt(props.width, source.length), width - (label ? visibleWidth(label) + 1 : 0)));
  const values = sample(source, available);
  const min = typeof props.min === "number" ? props.min : Math.min(...values);
  const max = typeof props.max === "number" ? props.max : Math.max(...values);
  const range = max - min || 1;
  const chart = values.map((value) => SPARK_BLOCKS[Math.min(7, Math.max(0, Math.round(((value - min) / range) * 7)))]).join("");
  return `${label ? `${label} ` : ""}${themeColor(stringProp(props, "color", "green"), theme)(chart)}`;
}

function renderBarChart(props: Record<string, unknown>, width: number, theme: JsonRenderTheme): string[] {
  const items = asRecords(props.data);
  const labels = items.map((item) => stringProp(item, "label"));
  const labelWidth = Math.min(Math.max(...labels.map(visibleWidth)), Math.max(4, Math.floor(width / 3)));
  const max = Math.max(...items.map((item) => numberProp(item.value, 0)), 1);
  const total = items.reduce((sum, item) => sum + numberProp(item.value, 0), 0);
  const suffixes = items.map((item) => {
    const parts: string[] = [];
    if (props.showValues === true) parts.push(String(numberProp(item.value, 0)));
    if (props.showPercentage === true && total > 0) parts.push(`${Math.round(numberProp(item.value, 0) / total * 100)}%`);
    return parts.join(" ");
  });
  const maxSuffix = Math.max(0, ...suffixes.map(visibleWidth));
  const barWidth = Math.max(1, Math.min(positiveInt(props.width, 30), width - labelWidth - maxSuffix - 2));
  return items.map((item, index) => {
    const label = truncateToWidth(labels[index]!, labelWidth, "…");
    const filled = Math.round(numberProp(item.value, 0) / max * barWidth);
    const suffix = suffixes[index] ? ` ${theme.dim(suffixes[index]!)}` : "";
    return `${padToWidth(label, labelWidth)} ${themeColor(stringProp(item, "color", "green"), theme)("█".repeat(filled))}${suffix}`;
  });
}

function renderTable(props: Record<string, unknown>, width: number, theme: JsonRenderTheme): string[] {
  const columns = asRecords(props.columns);
  const rows = asRecords(props.rows);
  const separatorWidth = Math.max(0, columns.length - 1);
  const available = Math.max(columns.length * 3, width - separatorWidth);
  const defaultWidth = Math.max(3, Math.floor(available / columns.length));
  let widths = columns.map((column) => Math.min(positiveInt(column.width, defaultWidth), defaultWidth));
  const used = widths.reduce((sum, item) => sum + item, 0);
  let spare = Math.max(0, available - used);
  widths = widths.map((item) => item + (spare-- > 0 ? 1 : 0));

  const headerValues = columns.map((column) => theme.accent(theme.bold(stringProp(column, "header"))));
  const output = [renderTableLine(headerValues, columns, widths, theme)];
  output.push(theme.dim(widths.map((columnWidth) => "─".repeat(columnWidth)).join("┼")));

  for (const row of rows) {
    const cellLines = columns.map((column, index) =>
      wrap(stringProp(row, stringProp(column, "key"), "—"), widths[index]!),
    );
    const height = Math.max(...cellLines.map((cell) => cell.length));
    for (let lineIndex = 0; lineIndex < height; lineIndex++) {
      const values = cellLines.map((cell) => cell[lineIndex] ?? "");
      output.push(renderTableLine(values, columns, widths, theme));
    }
  }
  return output;
}

function renderTableLine(values: string[], columns: Record<string, unknown>[], widths: number[], theme: JsonRenderTheme): string {
  return values.map((value, index) =>
    align(value, widths[index]!, stringProp(columns[index]!, "align", "left")),
  ).join(theme.muted("│"));
}

function renderList(props: Record<string, unknown>, width: number, theme: JsonRenderTheme): string[] {
  const items = Array.isArray(props.items) ? props.items.map(String) : [];
  const ordered = props.ordered === true;
  const bullet = stringProp(props, "bulletChar", "•");
  const spacing = positiveInt(props.spacing, 0);
  const blocks = items.map((item, index) => {
    const marker = ordered ? `${index + 1}.` : bullet;
    const contentWidth = Math.max(1, width - visibleWidth(marker) - 1);
    return wrap(item, contentWidth).map((line, lineIndex) =>
      `${lineIndex === 0 ? theme.accent(marker) : " ".repeat(visibleWidth(marker))} ${line}`,
    );
  });
  return joinVertical(blocks, spacing);
}

function renderKeyValue(props: Record<string, unknown>, width: number, theme: JsonRenderTheme): string[] {
  const label = `${stringProp(props, "label")}${stringProp(props, "separator", ":")}`;
  const prefix = `${theme.bold(theme.muted(label))} `;
  const valueWidth = Math.max(1, width - visibleWidth(prefix));
  const lines = wrap(displayValue(props.value) || "—", valueWidth);
  return lines.map((line, index) => `${index === 0 ? prefix : " ".repeat(visibleWidth(prefix))}${line}`);
}

function renderStatusLine(props: Record<string, unknown>, width: number, theme: JsonRenderTheme): string[] {
  const status = stringProp(props, "status", "info");
  const icon = stringProp(props, "icon", status === "success" ? "✓" : status === "warning" ? "!" : status === "error" ? "×" : "i");
  const prefix = `${styleForVariant(status, icon, theme)} `;
  return wrap(stringProp(props, "text"), Math.max(1, width - visibleWidth(prefix))).map((line, index) =>
    `${index === 0 ? prefix : " ".repeat(visibleWidth(prefix))}${line}`,
  );
}

function renderMetric(props: Record<string, unknown>, width: number, theme: JsonRenderTheme): string[] {
  const label = stringProp(props, "label");
  const value = theme.bold(stringProp(props, "value"));
  const detail = stringProp(props, "detail");
  const trend = stringProp(props, "trend");
  const detailText = trend === "up" ? theme.success(`+${detail}`) : trend === "down" ? theme.error(detail) : theme.muted(detail);
  return [...(label ? wrap(theme.dim(label), width) : []), ...wrap(`${value}${detail ? ` ${detailText}` : ""}`, width)];
}

function renderCallout(props: Record<string, unknown>, width: number, theme: JsonRenderTheme): string[] {
  const type = stringProp(props, "type", "info");
  const title = stringProp(props, "title", type.toUpperCase());
  const variant = type === "tip" ? "success" : type;
  const icon = type === "important" ? "◆" : type === "warning" ? "▲" : type === "tip" ? "✓" : "●";
  const marker = styleForVariant(variant, "│", theme);
  const prefixWidth = visibleWidth(marker) + 1;
  const contentWidth = Math.max(1, width - prefixWidth);
  const titleLines = title ? wrap(`${styleForVariant(variant, icon, theme)} ${styleForVariant(variant, theme.bold(title), theme)}`, contentWidth) : [];
  const contentLines = wrap(stringProp(props, "content"), contentWidth).map((line) => `${marker} ${line}`);
  return [...titleLines, ...contentLines];
}

function styleText(text: string, props: Record<string, unknown>, theme: JsonRenderTheme): string {
  let styled = themeColor(stringProp(props, "color", ""), theme)(text);
  if (props.bold === true) styled = theme.bold(styled);
  if (props.dimColor === true) styled = theme.dim(styled);
  if (props.italic === true) styled = theme.italic(styled);
  return styled;
}

function styleForVariant(variant: string, text: string, theme: JsonRenderTheme): string {
  if (variant === "success" || variant === "tip") return theme.success(text);
  if (variant === "warning") return theme.warning(text);
  if (variant === "error" || variant === "important") return theme.error(text);
  return variant === "default" ? theme.text(text) : theme.accent(text);
}

function themeColor(color: string, theme: JsonRenderTheme): (text: string) => string {
  if (color === "red") return theme.error;
  if (color === "green") return theme.success;
  if (color === "yellow") return theme.warning;
  if (color === "gray" || color === "white") return theme.muted;
  if (color) return theme.accent;
  return theme.text;
}

function wrap(text: string, width: number): string[] {
  return wrapTextWithAnsi(text, Math.max(1, width));
}

function padToWidth(text: string, width: number): string {
  return `${truncateToWidth(text, width, "")}${" ".repeat(Math.max(0, width - visibleWidth(text)))}`;
}

function joinVertical(blocks: string[][], gap: number): string[] {
  const output: string[] = [];
  blocks.forEach((block, index) => {
    if (index > 0) output.push(...Array.from({ length: gap }, () => ""));
    output.push(...block);
  });
  return output;
}

function sample(values: number[], width: number): number[] {
  if (values.length <= width) return values;
  return Array.from({ length: width }, (_, index) =>
    values[Math.round(index * (values.length - 1) / Math.max(width - 1, 1))]!,
  );
}

function stringProp(record: Record<string, unknown>, key: string, fallback = ""): string {
  return stringValue(record[key], fallback);
}
function stringValue(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : value === undefined || value === null ? fallback : String(value);
}
function numberProp(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}
function positiveInt(value: unknown, fallback: number): number {
  return Math.max(0, Math.floor(numberProp(value, fallback)));
}
function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  return Math.min(max, Math.max(min, numberProp(value, fallback)));
}
function numberArray(value: unknown): number[] {
  return Array.isArray(value) ? value.filter((item): item is number => typeof item === "number") : [];
}
function asRecords(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value)
    ? value.filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null && !Array.isArray(item))
    : [];
}
function displayValue(value: unknown): string {
  if (value === undefined || value === null) return "";
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(displayValue).join(", ");
  return String(value);
}
function align(value: string, width: number, direction: string): string {
  const safe = truncateToWidth(value, width, "…");
  const padding = Math.max(0, width - visibleWidth(safe));
  if (direction === "right") return `${" ".repeat(padding)}${safe}`;
  if (direction === "center") return `${" ".repeat(Math.floor(padding / 2))}${safe}${" ".repeat(Math.ceil(padding / 2))}`;
  return `${safe}${" ".repeat(padding)}`;
}
