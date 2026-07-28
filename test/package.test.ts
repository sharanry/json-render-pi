import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

interface PackageJson {
  private?: boolean;
  files?: string[];
  publishConfig?: { access?: string };
  pi?: {
    extensions?: string[];
    skills?: string[];
    image?: string;
  };
}

const packageJson = readFile(new URL("../package.json", import.meta.url), "utf8")
  .then((contents) => JSON.parse(contents) as PackageJson);

test("package is configured for public npm publication", async () => {
  const manifest = await packageJson;

  assert.equal(manifest.private, undefined);
  assert.equal(manifest.publishConfig?.access, "public");
});

test("package publishes the Pi extension, skill, examples, and documentation", async () => {
  const manifest = await packageJson;

  assert.deepEqual(manifest.files, [
    "src",
    "skills",
    "examples",
    "docs/images",
    "README.md",
    "LICENSE",
  ]);
  assert.deepEqual(manifest.pi?.extensions, ["./src/index.ts"]);
  assert.deepEqual(manifest.pi?.skills, ["./skills"]);
  assert.equal(
    manifest.pi?.image,
    "https://raw.githubusercontent.com/sharanry/json-render-pi/main/docs/images/deployment-status.png",
  );
});
