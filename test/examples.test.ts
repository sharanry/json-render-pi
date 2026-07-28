import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { auditDesign } from "../src/dev/design-audit.ts";
import { ansiTheme } from "../src/dev/snapshot.ts";
import { renderSpec } from "../src/renderer.ts";
import { validateSpec } from "../src/spec.ts";

const examples = [["deployment-status", 80], ["agent-plan", 80], ["detailed-agent-plan", 120]] as const;

for (const [name, width] of examples) {
  test(`curated ${name} example validates and passes its design audit`, async () => {
    const input = JSON.parse(
      await readFile(new URL(`../examples/${name}.json`, import.meta.url), "utf8"),
    );
    const spec = requireValidSpec(input);
    const lines = renderSpec(spec, width, ansiTheme);

    assert.deepEqual(auditDesign(spec, lines, width), []);
    assert.ok(lines.length <= (width >= 120 ? 36 : 24));
  });
}

test("README embeds a valid PNG snapshot for every curated example", async () => {
  const readme = await readFile(new URL("../README.md", import.meta.url), "utf8");

  for (const [name] of examples) {
    const png = await readFile(new URL(`../docs/images/${name}.png`, import.meta.url));
    assert.deepEqual([...png.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
    assert.match(readme, new RegExp(`docs/images/${name}\\.png`));
    assert.match(readme, new RegExp(`examples/${name}\\.json`));
  }
});

function requireValidSpec(input: unknown) {
  const result = validateSpec(input);
  if (!result.ok) assert.fail(`Expected a valid example spec: ${result.error}`);
  return result.spec;
}
