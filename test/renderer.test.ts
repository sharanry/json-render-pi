import assert from "node:assert/strict";
import test from "node:test";

import { renderSpec } from "../src/renderer.ts";
import { validateSpec } from "../src/spec.ts";

const theme = {
  accent: (text: string) => `<accent>${text}</accent>`,
  text: (text: string) => text,
  muted: (text: string) => `<muted>${text}</muted>`,
  dim: (text: string) => `<dim>${text}</dim>`,
  success: (text: string) => `<success>${text}</success>`,
  warning: (text: string) => `<warning>${text}</warning>`,
  error: (text: string) => `<error>${text}</error>`,
  bold: (text: string) => `<bold>${text}</bold>`,
  italic: (text: string) => `<italic>${text}</italic>`,
};

test("validateSpec accepts a constrained JSON Render element tree", () => {
  const result = validateSpec({
    root: "layout",
    elements: {
      layout: { type: "Box", props: { flexDirection: "column" }, children: ["title"] },
      title: { type: "Heading", props: { text: "Deploy" }, children: [] },
    },
  });

  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.spec.root, "layout");
});

test("validateSpec reports missing child references", () => {
  const result = validateSpec({
    root: "layout",
    elements: {
      layout: { type: "Box", props: {}, children: ["absent"] },
    },
  });

  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.error, /absent/);
});

test("rejects malformed component props from the reported session", () => {
  const callout = validateSpec({
    root: "purpose",
    elements: {
      purpose: {
        type: "Callout",
        props: { variant: "info", title: "Purpose", text: "Wrong keys" },
        children: [],
      },
    },
  });
  const table = validateSpec({
    root: "modes",
    elements: {
      modes: {
        type: "Table",
        props: { columns: ["Area", "Meaning"], data: [["SO2", "Default"]] },
        children: [],
      },
    },
  });
  const list = validateSpec({
    root: "items",
    elements: {
      items: { type: "List", props: {}, children: ["item"] },
      item: { type: "ListItem", props: { text: "Wrong shape" }, children: [] },
    },
  });

  assert.equal(callout.ok, false);
  assert.equal(table.ok, false);
  assert.equal(list.ok, false);
  if (!callout.ok) assert.match(callout.error, /Callout.*content|variant|text/);
  if (!table.ok) assert.match(table.error, /Table.*columns|rows|data/);
  if (!list.ok) assert.match(list.error, /List.*items|children/);
});

test("rejects oversized specs before they reach the transcript", () => {
  const elements: Record<string, unknown> = Object.fromEntries(
    Array.from({ length: 31 }, (_, index) => [
      `text-${index}`,
      { type: "Text", props: { text: String(index) }, children: [] },
    ]),
  );
  elements.root = {
    type: "Box",
    props: { flexDirection: "column" },
    children: Object.keys(elements),
  };

  const result = validateSpec({ root: "root", elements });

  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.error, /at most 30 elements/i);
});

test("renders valid callout, table, and list contracts without empty placeholders", () => {
  const spec = {
    root: "guide",
    elements: {
      guide: { type: "Box" as const, props: { flexDirection: "column" as const, gap: 1 }, children: ["purpose", "modes", "steps"] },
      purpose: { type: "Callout" as const, props: { type: "info" as const, title: "Purpose", content: "Use the current stack by default." }, children: [] },
      modes: {
        type: "Table" as const,
        props: {
          columns: [
            { header: "Area", key: "area", width: 14 },
            { header: "Meaning", key: "meaning", width: 24 },
          ],
          rows: [
            { area: "SO2", meaning: "Current default" },
            { area: "M1", meaning: "Legacy" },
          ],
        },
        children: [],
      },
      steps: { type: "List" as const, props: { items: ["Use Bun", "Run tests"], ordered: true }, children: [] },
    },
  };
  const validation = validateSpec(spec);

  assert.equal(validation.ok, true);
  if (!validation.ok) return;
  const output = renderSpec(validation.spec, 60, plainTheme).join("\n");
  assert.match(output, /Use the current stack/);
  assert.match(output, /SO2\s+Current default/);
  assert.match(output, /1\. Use Bun/);
  assert.doesNotMatch(output, /\(empty table\)/);
});

test("renders a nested dashboard with semantic Pi theme slots", () => {
  const result = renderSpec(
    {
      root: "card",
      elements: {
        card: {
          type: "Card",
          props: { title: "Deploy status", padding: 1 },
          children: ["heading", "progress", "status"],
        },
        heading: {
          type: "Heading",
          props: { text: "Production", level: "h2" },
          children: [],
        },
        progress: {
          type: "ProgressBar",
          props: { label: "Rollout", progress: 0.5, width: 8, color: "green" },
          children: [],
        },
        status: {
          type: "StatusLine",
          props: { status: "success", text: "8 of 16 instances healthy" },
          children: [],
        },
      },
    },
    80,
    theme,
  );

  assert.match(result.join("\n"), /Deploy status/);
  assert.match(result.join("\n"), /<bold>Production<\/bold>/);
  assert.match(result.join("\n"), /<success>████<\/success>/);
  assert.match(result.join("\n"), /8 of 16 instances healthy/);
});

test("renders rows horizontally and fits every line within the requested width", () => {
  const result = renderSpec(
    {
      root: "row",
      elements: {
        row: {
          type: "Box",
          props: { flexDirection: "row", gap: 2 },
          children: ["left", "right"],
        },
        left: { type: "Text", props: { text: "alpha" }, children: [] },
        right: { type: "Text", props: { text: "beta" }, children: [] },
      },
    },
    12,
    theme,
  );

  assert.equal(result[0], "alpha  beta");
  assert.ok(result.every((line) => visibleLength(line) <= 12));
});

test("wraps long content inside a card instead of clipping it", () => {
  const result = renderSpec(
    {
      root: "card",
      elements: {
        card: { type: "Card", props: { title: "Guide", padding: 1 }, children: ["note"] },
        note: {
          type: "Callout",
          props: {
            type: "info",
            title: "Purpose",
            content: "Work in the current stack by default and read area-specific instructions before changing code.",
          },
          children: [],
        },
      },
    },
    42,
    plainTheme,
  );

  assert.ok(result.every((line) => line.length <= 42));
  assert.doesNotMatch(result.join("\n"), /…/);
  const normalized = result.join(" ").replace(/[│┌┐└┘─]/g, "").replace(/\s+/g, " ");
  assert.match(normalized, /area-specific instructions/);
  assert.match(normalized, /changing code/);
});

test("lays out multi-line row children in stable columns", () => {
  const result = renderSpec(
    {
      root: "row",
      elements: {
        row: { type: "Box", props: { flexDirection: "row", gap: 2 }, children: ["left", "right"] },
        left: { type: "Metric", props: { label: "Healthy", value: "12/12" }, children: [] },
        right: { type: "Metric", props: { label: "Rollout", value: "75%" }, children: [] },
      },
    },
    40,
    plainTheme,
  );

  assert.deepEqual(result, ["Healthy              Rollout", "12/12                75%"]);
});

const plainTheme = {
  accent: (text: string) => text,
  text: (text: string) => text,
  muted: (text: string) => text,
  dim: (text: string) => text,
  success: (text: string) => text,
  warning: (text: string) => text,
  error: (text: string) => text,
  bold: (text: string) => text,
  italic: (text: string) => text,
};

function visibleLength(value: string): number {
  return value.replace(/<\/?[a-z]+>/g, "").length;
}
