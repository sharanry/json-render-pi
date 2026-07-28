import assert from "node:assert/strict";
import test from "node:test";
import { Check } from "typebox/value";

import { renderJsonUiParameters } from "../src/spec.ts";

test("tool schema defers spec validation to the path-aware runtime validator", () => {
  const valid = {
    title: "Build",
    spec: {
      root: "card",
      elements: {
        card: { type: "Card", props: { title: "Build" }, children: ["status"] },
        status: {
          type: "StatusLine",
          props: { text: "Healthy", status: "success" },
          children: [],
        },
      },
    },
  };
  const malformed = {
    title: "Guide",
    spec: {
      root: "card",
      elements: {
        card: { type: "Card", props: {}, children: ["table"] },
        table: {
          type: "Table",
          props: { columns: ["Area", "Meaning"], data: [["SO2", "Default"]] },
          children: [],
        },
      },
    },
  };

  assert.equal(Check(renderJsonUiParameters, valid), true);
  assert.equal(Check(renderJsonUiParameters, malformed), true);
  assert.equal(Check(renderJsonUiParameters, { title: "Missing spec" }), false);
  assert.match(JSON.stringify(renderJsonUiParameters), /validated at runtime/i);
  assert.doesNotMatch(JSON.stringify(renderJsonUiParameters), /TextInput|Select|ConfirmInput|Tabs/);
});
