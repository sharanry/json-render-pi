import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { access, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import test from "node:test";

import { auditDesign } from "../src/dev/design-audit.ts";
import { ansiTheme, renderSnapshotPng, renderSnapshotSvg } from "../src/dev/snapshot.ts";
import { renderSpec } from "../src/renderer.ts";
import { validateSpec } from "../src/spec.ts";

const execFileAsync = promisify(execFile);

const usefulSpec = {
  root: "card",
  elements: {
    card: { type: "Card", props: { title: "Deployment", padding: 1 }, children: ["heading", "status", "progress"] },
    heading: { type: "Heading", props: { text: "Production", level: "h2" }, children: [] },
    status: { type: "StatusLine", props: { text: "12 of 12 instances healthy", status: "success" }, children: [] },
    progress: { type: "ProgressBar", props: { label: "Rollout", progress: 0.75, width: 20, color: "cyan" }, children: [] },
  },
};

test("design audit catches transcript height and prose-heavy tables", () => {
  const spec = {
    root: "layout",
    elements: {
      layout: { type: "Box", props: { flexDirection: "column", gap: 1 }, children: ["table", "a", "b", "c"] },
      table: {
        type: "Table",
        props: {
          columns: [{ header: "Topic", key: "topic" }, { header: "Explanation", key: "explanation" }],
          rows: [{ topic: "Architecture", explanation: "This long explanation belongs in a callout or list, not a compact table cell." }],
        },
        children: [],
      },
      a: { type: "List", props: { items: ["1", "2", "3", "4", "5", "6", "7", "8"] }, children: [] },
      b: { type: "List", props: { items: ["1", "2", "3", "4", "5", "6", "7", "8"] }, children: [] },
      c: { type: "List", props: { items: ["1", "2", "3", "4", "5", "6", "7", "8"] }, children: [] },
    },
  };
  const validatedSpec = requireValidSpec(spec);
  const lines = renderSpec(validatedSpec, 80, ansiTheme);
  const findingCodes = auditDesign(validatedSpec, lines, 80).map(({ code }) => code);

  assert.deepEqual([...new Set(findingCodes)].sort(), ["height-budget", "long-list", "table-prose"]);
});

test("design audit accepts a compact status card", () => {
  const validatedSpec = requireValidSpec(usefulSpec);
  const lines = renderSpec(validatedSpec, 80, ansiTheme);

  assert.deepEqual(auditDesign(validatedSpec, lines, 80), []);
});

test("snapshot renderer creates inspectable SVG and PNG artifacts", async () => {
  const validatedSpec = requireValidSpec(usefulSpec);
  const lines = renderSpec(validatedSpec, 60, ansiTheme);
  const svg = renderSnapshotSvg(lines, { columns: 60, title: "Deployment <prod>" });
  const png = await renderSnapshotPng(lines, { columns: 60, title: "Deployment" });

  assert.match(svg, /^<svg/);
  assert.match(svg, /Deployment &lt;prod&gt;/);
  assert.doesNotMatch(svg, /\x1b/);
  assert.match(svg, /data-cell="59"[^>]*>│<\/text>/);
  assert.deepEqual([...png.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
});

test("Storybook exposes every example with adjustable terminal widths", async () => {
  const packageJson = JSON.parse(await readFile("package.json", "utf8"));
  assert.equal(packageJson.scripts.storybook, "storybook dev -p 6006");
  assert.equal(packageJson.scripts["storybook:build"], "storybook build");

  await access(".storybook/main.ts");
  await access(".storybook/preview.ts");
  const stories = await readFile("stories/json-ui.stories.ts", "utf8");
  for (const example of ["deployment-status", "agent-plan", "detailed-agent-plan"]) {
    assert.match(stories, new RegExp(`examples/${example}\\.json`));
  }
  assert.match(stories, /width.*control.*range/s);
  assert.match(stories, /renderSpec/);
  assert.match(stories, /validateSpec/);

  const renderer = await readFile("src/renderer.ts", "utf8");
  assert.doesNotMatch(renderer, /from "@earendil-works\/pi-tui"/);
  assert.match(renderer, /from "@earendil-works\/pi-tui\/dist\/utils\.js"/);
});

test("Storybook includes a configurable component dashboard", async () => {
  const playground = await readFile("stories/dashboard.stories.ts", "utf8");
  for (const component of ["Text", "Heading", "Divider", "Badge", "ProgressBar", "Sparkline", "BarChart", "Table", "List", "KeyValue", "StatusLine", "Metric", "Callout"]) {
    assert.match(playground, new RegExp(`type: \\"${component}\\"`));
  }
  assert.match(playground, /Add component/);
  assert.match(playground, /Remove/);
  assert.match(playground, /Move up/);
  assert.match(playground, /Move down/);
  assert.match(playground, /width.*control.*range/s);
  assert.match(playground, /validateSpec/);
  assert.match(playground, /renderSpec/);
});

test("developer CLI writes text, PNG, and audit report outputs", async () => {
  const directory = await mkdtemp(join(tmpdir(), "json-render-pi-"));
  const specPath = join(directory, "spec.json");
  const asciiPath = join(directory, "preview.txt");
  const pngPath = join(directory, "preview.png");
  const reportPath = join(directory, "report.json");
  await writeFile(specPath, JSON.stringify(usefulSpec), "utf8");

  const help = await execFileAsync(process.execPath, ["--import", "tsx", "scripts/json-ui-dev.ts", "--help"]);
  assert.match(help.stdout, /--watch/);
  assert.match(help.stdout, /--png/);
  assert.match(help.stdout, /--no-open/);

  const run = await execFileAsync(process.execPath, [
    "--import", "tsx", "scripts/json-ui-dev.ts", specPath,
    "--width", "60",
    "--ascii", asciiPath,
    "--png", pngPath,
    "--report", reportPath,
    "--no-color",
    "--no-open",
  ]);
  const [ascii, png, report] = await Promise.all([
    readFile(asciiPath, "utf8"),
    readFile(pngPath),
    readFile(reportPath, "utf8").then(JSON.parse),
  ]);

  assert.match(run.stdout, /VALID/);
  assert.match(ascii, /Deployment/);
  assert.deepEqual([...png.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  assert.equal(report.valid, true);
  assert.deepEqual(report.findings, []);
});

function requireValidSpec(input: unknown) {
  const result = validateSpec(input);
  if (!result.ok) assert.fail(`Expected a valid spec: ${result.error}`);
  return result.spec;
}
