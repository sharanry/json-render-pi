---
name: json-ui
description: Render compact, read-only inline terminal UIs with the render_json_ui tool. Use for dashboards, status summaries, comparisons, tables, progress, trends, checklists, or plans when a visual layout makes the answer easier to scan.
---

# Inline JSON UI

Use `render_json_ui` for a read-only visual summary directly in Pi's transcript.
It is not a dialog. Do not ask the user to open, close, or interact with it.

## When to render

Use it for dashboards, release or system status, plans, comparisons, metrics,
progress, trends, compact tables, and checklists. Do not replace a simple answer,
code block, long document, or detailed prose explanation with UI chrome. Never
include secrets because tool results are stored in the session transcript.

## Hard layout rules

- The root must be `Box` or `Card`.
- Only `Box` and `Card` may have children. Every other component uses
  `"children": []` and receives content through `props`.
- Prefer one outer `Card`, at most 5–6 sections, and fewer than 20 elements.
- Use a column `Box` for normal layout. A row `Box` is only for 2–4 compact
  metrics or key/value items; long text does not belong in a row.
- Tables are for short scalar values, never paragraph text. Use at most 3
  columns and 6 rows when possible.
- Keep important text under 160 characters. Summarize before rendering.
- Do not invent prop names or unsupported components. A rejected tool call must
  be corrected using its validation message rather than retried unchanged.

## Supported contracts

Every element has exactly `type`, `props`, and `children`.

- `Box`: `{ flexDirection?: "row"|"column", padding?: 0..2, gap?: 0..2 }`
- `Card`: `{ title?: string, padding?: 0..2 }`
- `Text`: `{ text, color?, bold?, italic?, dimColor? }`
- `Heading`: `{ text, level?: "h1"|"h2"|"h3"|"h4", color? }`
- `Divider`: `{ title?, character?, width?, dimColor? }`
- `Badge`: `{ label, variant?: "default"|"info"|"success"|"warning"|"error" }`
- `KeyValue`: `{ label, value, separator? }`
- `StatusLine`: `{ text, status?: "info"|"success"|"warning"|"error", icon? }`
- `Metric`: `{ label, value, detail?, trend?: "up"|"down"|"neutral" }`
- `ProgressBar`: `{ progress: 0..1, label?, width?, color? }`
- `Sparkline`: `{ data: number[], label?, width?, color?, min?, max? }`
- `BarChart`: `{ data: [{ label, value, color? }], width?, showValues?, showPercentage? }`
- `List`: `{ items: string[], ordered?, bulletChar?, spacing? }`
- `Callout`: `{ type?: "info"|"tip"|"warning"|"important", title?, content }`
- `Table`: `{ columns: [{ header, key, width?, align? }], rows: [{ "key": "value" }] }`

Colors are limited to `red`, `green`, `yellow`, `blue`, `magenta`, `cyan`,
`white`, and `gray`.

## Correct patterns

A list stores strings in `props.items`; it never has item children:

```json
{
  "type": "List",
  "props": { "items": ["Run tests", "Review diff", "Deploy"], "ordered": true },
  "children": []
}
```

A table uses column descriptors and object rows. The row keys match column keys:

```json
{
  "type": "Table",
  "props": {
    "columns": [
      { "header": "Service", "key": "service", "width": 18 },
      { "header": "Status", "key": "status", "width": 12 }
    ],
    "rows": [
      { "service": "API", "status": "Healthy" },
      { "service": "Worker", "status": "Deploying" }
    ]
  },
  "children": []
}
```

A callout uses `type` and `content`, not `variant` and `text`:

```json
{
  "type": "Callout",
  "props": { "type": "tip", "title": "Next step", "content": "Run the focused test suite." },
  "children": []
}
```

## Coding-plan layouts

For a compact plan, show scope/risk metrics, an ordered `List` of execution
phases, a verification `Table`, and a stop-condition `Callout`. For a detailed
plan, add:

- a file-level `Table` with `Path`, `Change`, and `Verification` columns;
- a multiline `Text` element containing a compact ASCII information-flow
  diagram; and
- a database `Table` with `Table`, `Columns`, and `Purpose` columns when the
  task actually introduces or changes persistence.

Use real project-relative file paths after inspecting the repository. Clearly
label proposed schemas and do not invent database changes merely to fill the
layout. Detailed plans are best rendered around 120 columns; compact plans must
remain useful at 80 columns.

## Workflow

1. Summarize the information into a compact visual hierarchy.
2. Build one complete spec; verify every child id exists exactly once.
3. Check every component against the contracts above.
4. Call `render_json_ui` with the spec and a short title.
5. Follow it with only an essential caveat or next action.
