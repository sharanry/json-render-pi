import assert from "node:assert/strict";
import test from "node:test";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

import jsonRenderPi from "../src/index.ts";

type TestTheme = { fg: (color: string, text: string) => string };
type RenderedComponent = { render: (width: number) => string[] };

type RegisteredTool = {
  renderShell?: string;
  renderCall?: (
    args: { title?: string },
    theme: TestTheme,
  ) => RenderedComponent;
  renderResult?: (
    result: {
      content: Array<{ type: "text"; text: string }>;
      details?: unknown;
    },
    options: { expanded: boolean; isPartial: boolean },
    theme: TestTheme,
    context: { isError: boolean },
  ) => RenderedComponent;
};

function registerJsonUiTool(): RegisteredTool {
  let definition: RegisteredTool | undefined;
  const api = {
    registerTool(tool: RegisteredTool) {
      definition = tool;
    },
  };

  jsonRenderPi(api as unknown as ExtensionAPI);
  assert.ok(definition);
  return definition;
}

test("JSON UI tool owns its shell instead of inheriting Pi's green success background", () => {
  assert.equal(registerJsonUiTool().renderShell, "self");
});

test("tool call headers show only the title without a json ui prefix", () => {
  const renderCall = registerJsonUiTool().renderCall;
  assert.ok(renderCall);
  const theme = { fg: (_color: string, text: string) => text };

  assert.deepEqual(renderCall({ title: "Deployment status" }, theme).render(80), ["Deployment status"]);
  assert.deepEqual(renderCall({}, theme).render(80), ["json-render UI"]);
});

test("failed JSON UI calls render the actual validation error", () => {
  const renderResult = registerJsonUiTool().renderResult;
  assert.ok(renderResult);
  const error = "Invalid json-render spec: root: expected string, received undefined";
  const output = renderResult(
    { content: [{ type: "text", text: error }] },
    { expanded: false, isPartial: false },
    { fg: (_color: string, text: string) => text },
    { isError: true },
  ).render(80).join("\n");

  assert.match(output, /Invalid json-render spec/);
  assert.match(output, /expected string/);
  assert.doesNotMatch(output, /No json-render spec was returned/);
});
