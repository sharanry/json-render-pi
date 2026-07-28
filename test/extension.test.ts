import assert from "node:assert/strict";
import test from "node:test";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

import jsonRenderPi from "../src/index.ts";

type RegisteredTool = {
  renderShell?: string;
  renderCall?: (
    args: { title?: string },
    theme: { fg: (color: string, text: string) => string },
  ) => { render: (width: number) => string[] };
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
