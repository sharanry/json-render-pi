import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("packages the json-ui skill for model invocation", async () => {
  const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8")) as {
    pi?: { skills?: string[] };
  };
  const skill = await readFile(new URL("../skills/json-ui/SKILL.md", import.meta.url), "utf8");
  const extension = await readFile(new URL("../src/index.ts", import.meta.url), "utf8");

  assert.deepEqual(packageJson.pi?.skills, ["./skills"]);
  assert.match(skill, /^---\nname: json-ui\ndescription: .+\n---/m);
  assert.doesNotMatch(skill, /disable-model-invocation:\s*true/);
  assert.match(skill, /render_json_ui/);
  assert.match(skill, /Table.*columns.*header.*key.*rows/s);
  assert.match(skill, /Callout.*type.*content/s);
  assert.doesNotMatch(skill, /ListItem|TextInput|MultiSelect|ConfirmInput|Tabs/);
  assert.doesNotMatch(extension, /registerCommand\("json-ui"/);
});
