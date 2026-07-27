import assert from "node:assert/strict";
import test from "node:test";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

import jsonRenderPi from "../src/index.ts";

test("JSON UI tool owns its shell instead of inheriting Pi's green success background", () => {
  let definition: { renderShell?: string } | undefined;
  const api = {
    registerTool(tool: { renderShell?: string }) {
      definition = tool;
    },
  };

  jsonRenderPi(api as unknown as ExtensionAPI);

  assert.equal(definition?.renderShell, "self");
});
