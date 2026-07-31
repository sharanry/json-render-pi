import { Type } from "typebox";
import { z } from "zod";

import { assertUpstreamComponents } from "./catalog.ts";

const MAX_ELEMENTS = 30;
const MAX_DEPTH = 6;
const MAX_TOTAL_TEXT = 5_000;

const colorSchema = z.enum([
  "red",
  "green",
  "yellow",
  "blue",
  "magenta",
  "cyan",
  "white",
  "gray",
]);
const optionalColor = colorSchema.nullish();
const bodyText = z.string().max(600);

const componentProps = {
  Box: z.strictObject({
    flexDirection: z.enum(["row", "column"]).nullish(),
    padding: z.number().int().min(0).max(2).nullish(),
    gap: z.number().int().min(0).max(2).nullish(),
  }),
  Card: z.strictObject({
    title: z.string().max(80).nullish(),
    padding: z.number().int().min(0).max(2).nullish(),
  }),
  Text: z.strictObject({
    text: z.string().max(500),
    color: optionalColor,
    bold: z.boolean().nullish(),
    italic: z.boolean().nullish(),
    dimColor: z.boolean().nullish(),
  }),
  Heading: z.strictObject({
    text: z.string().max(120),
    level: z.enum(["h1", "h2", "h3", "h4"]).nullish(),
    color: optionalColor,
  }),
  Divider: z.strictObject({
    character: z.string().min(1).max(2).nullish(),
    title: z.string().max(80).nullish(),
    width: z.number().int().min(1).max(120).nullish(),
    dimColor: z.boolean().nullish(),
  }),
  Badge: z.strictObject({
    label: z.string().max(40),
    variant: z.enum(["default", "info", "success", "warning", "error"]).nullish(),
  }),
  ProgressBar: z.strictObject({
    progress: z.number().min(0).max(1),
    width: z.number().int().min(1).max(60).nullish(),
    color: optionalColor,
    label: z.string().max(40).nullish(),
  }),
  Sparkline: z.strictObject({
    data: z.array(z.number().finite()).min(1).max(40),
    width: z.number().int().min(1).max(80).nullish(),
    color: optionalColor,
    label: z.string().max(40).nullish(),
    min: z.number().finite().nullish(),
    max: z.number().finite().nullish(),
  }),
  BarChart: z.strictObject({
    data: z.array(z.strictObject({
      label: z.string().max(40),
      value: z.number().finite().min(0),
      color: optionalColor,
    })).min(1).max(8),
    width: z.number().int().min(1).max(60).nullish(),
    showValues: z.boolean().nullish(),
    showPercentage: z.boolean().nullish(),
  }),
  Table: z.strictObject({
    columns: z.array(z.strictObject({
      header: z.string().max(40),
      key: z.string().min(1).max(40),
      width: z.number().int().min(3).max(60).nullish(),
      align: z.enum(["left", "center", "right"]).nullish(),
    })).min(1).max(4),
    rows: z.array(z.record(z.string(), z.string().max(100))).max(8),
  }),
  List: z.strictObject({
    items: z.array(z.string().max(200)).min(1).max(8),
    ordered: z.boolean().nullish(),
    bulletChar: z.string().min(1).max(2).nullish(),
    spacing: z.number().int().min(0).max(1).nullish(),
  }),
  KeyValue: z.strictObject({
    label: z.string().max(40),
    value: z.union([
      z.string().max(240),
      z.number().finite(),
      z.array(z.string().max(80)).max(6),
    ]),
    separator: z.string().min(1).max(4).nullish(),
  }),
  StatusLine: z.strictObject({
    text: z.string().max(240),
    status: z.enum(["info", "success", "warning", "error"]).nullish(),
    icon: z.string().min(1).max(3).nullish(),
  }),
  Metric: z.strictObject({
    label: z.string().max(40),
    value: z.string().max(80),
    detail: z.string().max(100).nullish(),
    trend: z.enum(["up", "down", "neutral"]).nullish(),
  }),
  Callout: z.strictObject({
    type: z.enum(["info", "tip", "warning", "important"]).nullish(),
    title: z.string().max(80).nullish(),
    content: bodyText,
  }),
} as const;

export const supportedComponentNames = Object.keys(componentProps);
assertUpstreamComponents(supportedComponentNames);

const leaf = <Name extends Exclude<keyof typeof componentProps, "Box" | "Card">>(name: Name) =>
  z.strictObject({
    type: z.literal(name),
    props: componentProps[name],
    children: z.array(z.string()).max(0, `${name} is a leaf component; put content in props instead of children`),
  });

const container = <Name extends "Box" | "Card">(name: Name) =>
  z.strictObject({
    type: z.literal(name),
    props: componentProps[name],
    children: z.array(z.string()).max(12),
  });

export const jsonRenderElementSchema = z.discriminatedUnion("type", [
  container("Box"),
  container("Card"),
  leaf("Text"),
  leaf("Heading"),
  leaf("Divider"),
  leaf("Badge"),
  leaf("ProgressBar"),
  leaf("Sparkline"),
  leaf("BarChart"),
  leaf("Table"),
  leaf("List"),
  leaf("KeyValue"),
  leaf("StatusLine"),
  leaf("Metric"),
  leaf("Callout"),
]);

export const jsonRenderSpecSchema = z.strictObject({
  root: z.string().min(1),
  elements: z.record(z.string(), jsonRenderElementSchema),
});

/**
 * Expose the normalized graph envelope to the model and validate it at the tool
 * boundary. Element values stay open because Pi flattens nested union failures
 * into misleading `spec.elements` errors; validateSpec() remains the source of
 * precise component, property, index, and limit diagnostics at runtime.
 */
export const renderJsonUiParameters = Type.Object({
  spec: Type.Object({
    root: Type.String({
      minLength: 1,
      description: "The ID of the root Box or Card in spec.elements.",
    }),
    elements: Type.Record(Type.String(), Type.Unknown({
      description: "A JSON UI element with type, props, and string child IDs. Component details are validated at runtime.",
    }), {
      description: "A map of element IDs to JSON UI elements. Container children reference IDs in this map.",
    }),
  }, {
    additionalProperties: false,
    description: "A normalized JSON UI graph with a root element ID and an elements map; never nest element objects in children.",
  }),
  title: Type.Optional(Type.String({ minLength: 1, maxLength: 80, description: "A concise label for the rendered UI." })),
}, { additionalProperties: false });

export type JsonRenderElement = z.infer<typeof jsonRenderElementSchema>;
export type JsonRenderSpec = z.infer<typeof jsonRenderSpecSchema>;

export type SpecValidation =
  | { ok: true; spec: JsonRenderSpec }
  | { ok: false; error: string };

/** Validate component contracts plus transcript-oriented complexity budgets. */
export function validateSpec(value: unknown): SpecValidation {
  if (isRecord(value) && isRecord(value.elements)) {
    const received = Object.keys(value.elements).length;
    if (received > MAX_ELEMENTS) {
      return { ok: false, error: `A JSON UI may contain at most ${MAX_ELEMENTS} elements; received ${received}.` };
    }
  }

  const parsed = jsonRenderSpecSchema.safeParse(value);
  if (!parsed.success) return { ok: false, error: formatIssue(parsed.error.issues[0], value) };

  const spec = parsed.data;
  const entries = Object.entries(spec.elements);
  if (entries.length > MAX_ELEMENTS) {
    return { ok: false, error: `A JSON UI may contain at most ${MAX_ELEMENTS} elements; received ${entries.length}.` };
  }
  if (!spec.elements[spec.root]) {
    return { ok: false, error: `Root element "${spec.root}" is not defined.` };
  }
  if (!isContainer(spec.elements[spec.root])) {
    return { ok: false, error: `Root element "${spec.root}" must be a Box or Card.` };
  }

  for (const [id, element] of entries) {
    for (const child of element.children) {
      if (!spec.elements[child]) {
        return { ok: false, error: `Element "${id}" references missing child "${child}".` };
      }
    }
    if (element.type === "Box" && element.props.flexDirection === "row" && element.children.length > 4) {
      return { ok: false, error: `Row Box "${id}" may contain at most 4 children.` };
    }
  }

  const visited = new Set<string>();
  const active = new Set<string>();
  const traversalError = walk(spec.root, 1);
  if (traversalError) return { ok: false, error: traversalError };
  if (visited.size !== entries.length) {
    const unreachable = entries.map(([id]) => id).filter((id) => !visited.has(id));
    return { ok: false, error: `Every element must be reachable from root; unreachable: ${unreachable.join(", ")}.` };
  }

  const cardCount = entries.filter(([, element]) => element.type === "Card").length;
  if (cardCount > 2) return { ok: false, error: `A JSON UI may contain at most 2 Card elements; received ${cardCount}.` };

  const totalText = countText(spec);
  if (totalText > MAX_TOTAL_TEXT) {
    return { ok: false, error: `A JSON UI may contain at most ${MAX_TOTAL_TEXT} text characters; received ${totalText}.` };
  }

  return { ok: true, spec };

  function walk(id: string, depth: number): string | undefined {
    if (active.has(id)) return `Circular element reference detected at "${id}".`;
    if (depth > MAX_DEPTH) return `JSON UI nesting may be at most ${MAX_DEPTH} levels; "${id}" is deeper.`;
    if (visited.has(id)) return undefined;
    visited.add(id);
    active.add(id);
    for (const child of spec.elements[id]!.children) {
      const error = walk(child, depth + 1);
      if (error) return error;
    }
    active.delete(id);
    return undefined;
  }
}

function formatIssue(issue: z.core.$ZodIssue | undefined, value: unknown): string {
  if (!issue) return "Invalid JSON UI specification.";
  const path = issue.path.map(String);
  if (path[0] === "elements" && path[1]) {
    const id = path[1];
    const element = isRecord(value) && isRecord(value.elements) && isRecord(value.elements[id])
      ? value.elements[id]
      : undefined;
    const type = element && typeof element.type === "string" ? ` (${element.type})` : "";
    const propertyPath = path.slice(2).join(".");
    return `Element "${id}"${type}${propertyPath ? ` ${propertyPath}` : ""}: ${issue.message}`;
  }
  return `${path.length > 0 ? `${path.join(".")}: ` : ""}${issue.message}`;
}

function countText(value: unknown): number {
  if (typeof value === "string") return value.length;
  if (Array.isArray(value)) return value.reduce<number>((total, item) => total + countText(item), 0);
  if (isRecord(value)) return Object.values(value).reduce<number>((total, item) => total + countText(item), 0);
  return 0;
}

function isContainer(element: JsonRenderElement): boolean {
  return element.type === "Box" || element.type === "Card";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
