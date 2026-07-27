#!/usr/bin/env node
import { execFile } from "node:child_process";
import { watch } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";
import { parseArgs } from "node:util";

import { auditDesign, type DesignFinding } from "../src/dev/design-audit.ts";
import {
  ansiTheme,
  plainTheme,
  renderSnapshotPng,
  renderSnapshotSvg,
} from "../src/dev/snapshot.ts";
import { renderSpec } from "../src/renderer.ts";
import { validateSpec } from "../src/spec.ts";

const HELP = `json-ui-dev — validate, render, audit, and snapshot a JSON UI spec

Usage:
  npm run ui:dev -- <spec.json> [options]
  npm run ui:dev -- <spec.json> --watch --png .artifacts/preview.png
  cat spec.json | npm run ui:dev -- - --width 80

Options:
  -w, --width <columns>  Preview width from 40 to 200 (default: 80)
      --ascii <path>     Save a plain-text rendering
      --svg <path>       Save a styled SVG rendering
      --png <path>       Save a styled PNG screenshot and open it in macOS Preview
      --report <path>    Save validation and design findings as JSON
      --strict           Exit non-zero when the design audit has any findings
      --watch            Re-run whenever the JSON file changes
      --no-color         Print the terminal preview without ANSI colors
      --no-open          Do not open generated PNGs (intended for CI/tests)
  -h, --help             Show this help

Workflow:
  1. Edit a complete constrained json-render spec.
  2. The same validator used by the Pi tool accepts or rejects it.
  3. Inspect the terminal preview and design findings.
  4. Inspect the PNG opened in Preview, iterate, and save the final artifacts.
`;

const parsed = parseArgs({
  allowPositionals: true,
  strict: true,
  options: {
    help: { type: "boolean", short: "h" },
    width: { type: "string", short: "w", default: "80" },
    ascii: { type: "string" },
    svg: { type: "string" },
    png: { type: "string" },
    report: { type: "string" },
    strict: { type: "boolean" },
    watch: { type: "boolean" },
    "no-color": { type: "boolean" },
    "no-open": { type: "boolean" },
  },
});

if (parsed.values.help) {
  process.stdout.write(HELP);
  process.exit(0);
}

const inputPath = parsed.positionals[0];
if (!inputPath || parsed.positionals.length > 1) {
  process.stderr.write(`${HELP}\nError: provide exactly one JSON spec path (or - for stdin).\n`);
  process.exit(1);
}

const width = Number.parseInt(parsed.values.width ?? "80", 10);
if (!Number.isInteger(width) || width < 40 || width > 200) {
  process.stderr.write("Error: --width must be an integer from 40 to 200.\n");
  process.exit(1);
}
if (parsed.values.watch && inputPath === "-") {
  process.stderr.write("Error: --watch requires a file path, not stdin.\n");
  process.exit(1);
}

const absoluteInput = inputPath === "-" ? "-" : resolve(inputPath);
let stdinCache: string | undefined;

async function runOnce(): Promise<number> {
  let raw: string;
  try {
    if (absoluteInput === "-") {
      stdinCache ??= await readStdin();
      raw = stdinCache;
    } else {
      raw = await readFile(absoluteInput, "utf8");
    }
  } catch (error) {
    return reject(`Could not read ${inputPath}: ${errorMessage(error)}`);
  }

  let input: unknown;
  try {
    input = JSON.parse(raw);
  } catch (error) {
    return reject(`Invalid JSON: ${errorMessage(error)}`);
  }

  const validation = validateSpec(input);
  if (!validation.ok) return reject(validation.error);

  const terminalTheme = parsed.values["no-color"] ? plainTheme : ansiTheme;
  const lines = renderSpec(validation.spec, width, terminalTheme);
  const snapshotLines = parsed.values["no-color"]
    ? renderSpec(validation.spec, width, ansiTheme)
    : lines;
  const findings = auditDesign(validation.spec, lines, width);
  const title = parsed.values.png || parsed.values.svg
    ? `JSON UI preview · ${absoluteInput === "-" ? "stdin" : basename(absoluteInput)}`
    : undefined;

  process.stdout.write(`\nVALID  ${Object.keys(validation.spec.elements).length} elements • ${lines.length} lines • ${width} columns\n`);
  printFindings(findings);
  process.stdout.write(`${lines.join("\n")}\n`);

  const artifacts: Record<string, string> = {};
  if (parsed.values.ascii) {
    const path = resolve(parsed.values.ascii);
    await writeArtifact(path, `${stripAnsi(lines.join("\n"))}\n`);
    artifacts.ascii = path;
  }
  if (parsed.values.svg) {
    const path = resolve(parsed.values.svg);
    await writeArtifact(path, renderSnapshotSvg(snapshotLines, { columns: width, title }));
    artifacts.svg = path;
  }
  if (parsed.values.png) {
    const path = resolve(parsed.values.png);
    const png = await renderSnapshotPng(snapshotLines, { columns: width, title });
    await writeArtifact(path, png);
    artifacts.png = path;
    if (!parsed.values["no-open"]) await openInPreview(path);
  }
  if (parsed.values.report) {
    const path = resolve(parsed.values.report);
    artifacts.report = path;
    await writeArtifact(path, `${JSON.stringify({
      valid: true,
      input: absoluteInput,
      width,
      lineCount: lines.length,
      elementCount: Object.keys(validation.spec.elements).length,
      findings,
      artifacts,
    }, null, 2)}\n`);
  }

  for (const [kind, path] of Object.entries(artifacts)) {
    process.stdout.write(`WROTE  ${kind}: ${path}\n`);
  }
  return parsed.values.strict && findings.length > 0 ? 2 : 0;
}

async function reject(message: string): Promise<number> {
  process.stdout.write(`\nREJECTED  ${message}\n`);
  if (parsed.values.report) {
    await writeArtifact(resolve(parsed.values.report), `${JSON.stringify({ valid: false, error: message }, null, 2)}\n`);
  }
  return 1;
}

async function openInPreview(path: string): Promise<void> {
  if (process.platform !== "darwin") {
    process.stdout.write("SKIP   macOS Preview is unavailable on this platform.\n");
    return;
  }
  await new Promise<void>((resolvePromise, rejectPromise) => {
    execFile("open", ["-a", "Preview", path], (error) => {
      if (error) rejectPromise(error);
      else resolvePromise();
    });
  });
  process.stdout.write(`OPENED ${path}\n`);
}

function printFindings(findings: readonly DesignFinding[]): void {
  if (findings.length === 0) {
    process.stdout.write("AUDIT  clean\n");
    return;
  }
  for (const finding of findings) {
    const icon = finding.level === "error" ? "ERROR" : finding.level === "warning" ? "WARN " : "NOTE ";
    const location = finding.elementId ? ` [${finding.elementId}]` : "";
    process.stdout.write(`${icon}  ${finding.code}${location}: ${finding.message}\n`);
  }
}

async function writeArtifact(path: string, contents: string | Uint8Array): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, contents);
}

function stripAnsi(value: string): string {
  return value.replace(/\x1B\[[0-?]*[ -/]*[@-~]/g, "");
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks).toString("utf8");
}

if (parsed.values.watch) {
  let timer: NodeJS.Timeout | undefined;
  const execute = async () => {
    const code = await runOnce().catch((error) => {
      process.stderr.write(`ERROR  ${errorMessage(error)}\n`);
      return 1;
    });
    process.exitCode = code;
  };
  await execute();
  process.stdout.write(`WATCH  ${absoluteInput}\n`);
  watch(absoluteInput, () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(execute, 80);
  });
} else {
  process.exitCode = await runOnce().catch((error) => {
    process.stderr.write(`ERROR  ${errorMessage(error)}\n`);
    return 1;
  });
}
