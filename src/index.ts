import type { ExtensionAPI, Theme } from "@earendil-works/pi-coding-agent";
import { truncateToWidth, type Component } from "@earendil-works/pi-tui";
import { renderSpec, type JsonRenderTheme } from "./renderer.ts";
import {
  renderJsonUiParameters,
  supportedComponentNames,
  validateSpec,
  type JsonRenderSpec,
} from "./spec.ts";

const TOOL_NAME = "render_json_ui";

type JsonRenderResultDetails = {
  title: string;
  spec: JsonRenderSpec;
};

/**
 * Adapts json-render's Ink component vocabulary to Pi's native TUI. Ink cannot
 * be mounted inside Pi (both own the terminal), so this keeps the spec and
 * catalog while translating the final element tree into Pi components.
 */
export default function jsonRenderPi(pi: ExtensionAPI) {
  pi.registerTool({
    name: TOOL_NAME,
    label: "Render JSON UI",
    renderShell: "self",
    description: "Render a constrained, read-only json-render UI in Pi's native terminal transcript. Supported components: " + supportedComponentNames.join(", ") + ". The schema rejects unsupported props, controls, actions, and oversized layouts.",
    promptSnippet: "Render a safe, read-only json-render Ink specification in Pi's terminal transcript",
    promptGuidelines: [
      "Use render_json_ui when the user asks for a compact terminal dashboard, status card, table, chart, or other visual summary.",
      "Use render_json_ui only with a complete spec that matches its exact schema; only Box and Card may have children, while leaf content belongs in props.",
      "Keep render_json_ui layouts compact: prefer one Card, column layout, lists via props.items, and tables with descriptor columns plus object rows.",
      "Do not put secrets in render_json_ui specs; its output is saved in the Pi session transcript.",
    ],
    parameters: renderJsonUiParameters,
    async execute(_toolCallId, params) {
      const validation = validateSpec(params.spec);
      if (!validation.ok) throw new Error(`Invalid json-render spec: ${validation.error}`);
      const title = params.title?.trim() || "json-render UI";
      return {
        content: [{ type: "text", text: `Rendered ${title}.` }],
        details: { title, spec: validation.spec } satisfies JsonRenderResultDetails,
      };
    },
    renderCall(args, theme) {
      const title = typeof args.title === "string" && args.title.trim() ? args.title : "json-render UI";
      return new StaticLines([
        `${theme.fg("dim", "json ui")}${theme.fg("muted", ` · ${title}`)}`,
      ]);
    },
    renderResult(result, _options, theme) {
      const details = result.details as JsonRenderResultDetails | undefined;
      if (!details?.spec) return new StaticLines([theme.fg("warning", "No json-render spec was returned.")]);
      return new JsonRenderView(details.spec, toJsonRenderTheme(theme));
    },
  });
}

class JsonRenderView implements Component {
  constructor(
    private readonly spec: JsonRenderSpec,
    private readonly theme: JsonRenderTheme,
  ) {}

  render(width: number): string[] {
    return renderSpec(this.spec, width, this.theme);
  }

  invalidate(): void {}
}

class StaticLines implements Component {
  constructor(private readonly lines: string[]) {}
  render(width: number): string[] { return this.lines.map((line) => truncateToWidth(line, width)); }
  invalidate(): void {}
}

function toJsonRenderTheme(theme: Theme): JsonRenderTheme {
  return {
    accent: (text) => theme.fg("accent", text),
    text: (text) => theme.fg("text", text),
    muted: (text) => theme.fg("muted", text),
    dim: (text) => theme.fg("dim", text),
    success: (text) => theme.fg("success", text),
    warning: (text) => theme.fg("warning", text),
    error: (text) => theme.fg("error", text),
    bold: (text) => theme.bold(text),
    italic: (text) => theme.italic(text),
  };
}

