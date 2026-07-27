import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { auditDesign } from "../src/dev/design-audit.ts";
import { ansiTheme } from "../src/dev/snapshot.ts";
import { renderSpec } from "../src/renderer.ts";
import { validateSpec } from "../src/spec.ts";

for (const [name, width] of [["deployment-status", 80], ["agent-plan", 80], ["detailed-agent-plan", 120]] as const) {
  test(`curated ${name} example validates and passes its design audit`, async () => {
    const input = JSON.parse(
      await readFile(new URL(`../examples/${name}.json`, import.meta.url), "utf8"),
    );
    const validation = validateSpec(input);

    assert.equal(validation.ok, true);
    if (!validation.ok) return;
    const lines = renderSpec(validation.spec, width, ansiTheme);
    assert.deepEqual(auditDesign(validation.spec, lines, width), []);
    assert.ok(lines.length <= (width >= 120 ? 36 : 24));
  });
}
