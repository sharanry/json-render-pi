# Development guidance

## JSON UI visual loop

For every renderer, schema, design-audit, theme, or example change, use the
standalone harness before considering the work complete:

```bash
npm test
npm run typecheck
npm run ui:dev -- examples/deployment-status.json \
  --width 80 \
  --png .artifacts/deployment-status.png \
  --report .artifacts/deployment-status.report.json \
  --strict
```

PNG screenshots open in macOS Preview by default. Inspect the actual image—not
only ANSI output—and iterate until hierarchy, wrapping, alignment, density, and
semantic color are clear. Use `--no-open` only in automated tests or CI.

Also review the agent-plan example when changing text-heavy layouts:

```bash
npm run ui:dev -- examples/agent-plan.json \
  --width 80 \
  --png .artifacts/agent-plan.png \
  --strict
```

Use `--watch` while iterating. It reruns validation, rendering, design audit,
artifact generation, and Preview opening after every JSON save:

```bash
npm run ui:dev -- examples/agent-plan.json \
  --watch \
  --width 80 \
  --png .artifacts/agent-plan.png \
  --report .artifacts/agent-plan.report.json \
  --strict
```

Before finalizing responsive renderer changes, repeat at 120 columns. Use the
detailed plan to exercise file paths, diagrams, and database schemas:

```bash
npm run ui:dev -- examples/detailed-agent-plan.json \
  --width 120 \
  --png .artifacts/detailed-agent-plan.png \
  --strict
```

Keep 80-column output within 24 lines and 120-column detailed output within 36
lines. Treat validator rejection and audit warnings as iteration feedback, not
output to work around.

Run `npm run ui:dev -- --help` for all harness options.
