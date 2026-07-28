import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const skill = readFile(new URL("../skills/json-ui/SKILL.md", import.meta.url), "utf8");

test("json-ui skill can be invoked by the model", async () => {
  const contents = await skill;

  assert.match(contents, /^---\nname: json-ui\ndescription: .+\n---/m);
  assert.doesNotMatch(contents, /disable-model-invocation:\s*true/);
  assert.match(contents, /render_json_ui/);
});

test("json-ui skill documents the supported component contracts", async () => {
  const contents = await skill;

  assert.match(contents, /Table.*columns.*header.*key.*rows/s);
  assert.match(contents, /Callout.*type.*content/s);
});

test("json-ui skill does not advertise unsupported interactive components", async () => {
  const contents = await skill;

  assert.doesNotMatch(contents, /ListItem|TextInput|MultiSelect|ConfirmInput|Tabs/);
});
