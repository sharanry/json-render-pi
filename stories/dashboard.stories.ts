import type { Meta, StoryObj } from "@storybook/html-vite";
import Convert from "ansi-to-html";

import { ansiTheme } from "../src/dev/theme.ts";
import { renderSpec } from "../src/renderer.ts";
import { validateSpec } from "../src/spec.ts";

type ComponentTemplate = {
  type: string;
  props: Record<string, unknown>;
  children: string[];
};

type DashboardArgs = { width: number };

type DashboardItem = ComponentTemplate & { id: string };

const COMPONENTS: ComponentTemplate[] = [
  { type: "Text", props: { text: "Supporting dashboard copy", color: "white" }, children: [] },
  { type: "Heading", props: { text: "Dashboard section", level: "h2" }, children: [] },
  { type: "Divider", props: { title: "Section" }, children: [] },
  { type: "Badge", props: { label: "Live", variant: "success" }, children: [] },
  { type: "ProgressBar", props: { label: "Progress", progress: 0.68, width: 24, color: "green" }, children: [] },
  { type: "Sparkline", props: { label: "Trend", data: [2, 4, 3, 6, 7, 5, 8, 9], color: "cyan" }, children: [] },
  { type: "BarChart", props: { data: [{ label: "API", value: 82, color: "cyan" }, { label: "Worker", value: 61, color: "green" }], showValues: true }, children: [] },
  { type: "Table", props: { columns: [{ header: "Service", key: "service" }, { header: "State", key: "state" }], rows: [{ service: "API", state: "Healthy" }, { service: "Worker", state: "Deploying" }] }, children: [] },
  { type: "List", props: { items: ["Validate the spec", "Render at target width", "Review the output"], ordered: true }, children: [] },
  { type: "KeyValue", props: { label: "Environment", value: "Production" }, children: [] },
  { type: "StatusLine", props: { text: "All systems operational", status: "success" }, children: [] },
  { type: "Metric", props: { label: "p95 latency", value: "82 ms", detail: "8% faster", trend: "up" }, children: [] },
  { type: "Callout", props: { type: "tip", title: "Next step", content: "Add another component from the palette." }, children: [] },
];

const ansi = new Convert({
  bg: "#111613",
  fg: "#d8e2da",
  newline: true,
  escapeXML: true,
});

let nextId = 1;

function newItem(template: ComponentTemplate): DashboardItem {
  return {
    id: `component-${nextId++}`,
    type: template.type,
    props: structuredClone(template.props),
    children: [],
  };
}

function createDashboard({ width: initialWidth }: DashboardArgs): HTMLElement {
  let width = initialWidth;
  let selectedType = "StatusLine";
  let items = [
    newItem(COMPONENTS.find(({ type }) => type === "Heading")!),
    newItem(COMPONENTS.find(({ type }) => type === "StatusLine")!),
    newItem(COMPONENTS.find(({ type }) => type === "Metric")!),
    newItem(COMPONENTS.find(({ type }) => type === "ProgressBar")!),
  ];

  const app = document.createElement("main");
  app.className = "dashboard-builder";
  app.innerHTML = `
    <aside class="builder-panel">
      <div class="builder-kicker">Composition lab</div>
      <h1>Dashboard builder</h1>
      <p>Add, configure, and reorder components while the production renderer updates live.</p>
      <label class="builder-field">
        <span>Terminal width <output data-width>${width}</output></span>
        <input data-width-input type="range" min="40" max="160" step="1" value="${width}">
      </label>
      <div class="builder-add">
        <label class="builder-field">
          <span>Component</span>
          <select data-component-select></select>
        </label>
        <button class="builder-primary" data-add type="button">Add component</button>
      </div>
      <div class="component-stack" data-components></div>
    </aside>
    <section class="builder-stage">
      <div class="preview-eyebrow" data-preview-label></div>
      <pre class="terminal-preview" data-preview aria-live="polite"></pre>
    </section>`;

  const select = app.querySelector<HTMLSelectElement>("[data-component-select]")!;
  for (const component of COMPONENTS) {
    const option = document.createElement("option");
    option.value = component.type;
    option.textContent = component.type;
    select.append(option);
  }
  select.value = selectedType;

  app.querySelector("[data-width-input]")!.addEventListener("input", (event) => {
    width = Number((event.target as HTMLInputElement).value);
    render();
  });
  select.addEventListener("change", () => { selectedType = select.value; });
  app.querySelector("[data-add]")!.addEventListener("click", () => {
    const template = COMPONENTS.find(({ type }) => type === selectedType)!;
    items = [...items, newItem(template)];
    render();
  });

  function move(index: number, offset: number): void {
    const target = index + offset;
    if (target < 0 || target >= items.length) return;
    const reordered = [...items];
    [reordered[index], reordered[target]] = [reordered[target]!, reordered[index]!];
    items = reordered;
    render();
  }

  function renderEditor(): void {
    const stack = app.querySelector<HTMLElement>("[data-components]")!;
    stack.replaceChildren();
    items.forEach((item, index) => {
      const card = document.createElement("article");
      card.className = "component-editor";
      card.innerHTML = `
        <header><strong>${item.type}</strong><span>${index + 1}</span></header>
        <textarea aria-label="${item.type} properties" spellcheck="false"></textarea>
        <footer>
          <button type="button" data-up aria-label="Move up">↑ Move up</button>
          <button type="button" data-down aria-label="Move down">↓ Move down</button>
          <button type="button" data-remove class="builder-danger">Remove</button>
        </footer>`;
      const textarea = card.querySelector("textarea")!;
      textarea.value = JSON.stringify(item.props, null, 2);
      textarea.addEventListener("input", () => {
        try {
          item.props = JSON.parse(textarea.value);
          textarea.removeAttribute("aria-invalid");
          renderPreview();
        } catch {
          textarea.setAttribute("aria-invalid", "true");
        }
      });
      card.querySelector("[data-up]")!.addEventListener("click", () => move(index, -1));
      card.querySelector("[data-down]")!.addEventListener("click", () => move(index, 1));
      card.querySelector("[data-remove]")!.addEventListener("click", () => {
        items = items.filter(({ id }) => id !== item.id);
        render();
      });
      stack.append(card);
    });
  }

  function renderPreview(): void {
    const preview = app.querySelector<HTMLElement>("[data-preview]")!;
    const label = app.querySelector<HTMLElement>("[data-preview-label]")!;
    app.querySelector<HTMLOutputElement>("[data-width]")!.value = `${width} cols`;
    label.textContent = `${items.length} components · ${width} columns · live`;
    preview.style.setProperty("--terminal-columns", String(width));

    const elements: Record<string, ComponentTemplate> = {
      dashboard: {
        type: "Card",
        props: { title: "Configurable dashboard", padding: 1 },
        children: items.map(({ id }) => id),
      },
    };
    for (const { id, type, props, children } of items) elements[id] = { type, props, children };

    const validation = validateSpec({ root: "dashboard", elements });
    if (!validation.ok) {
      preview.classList.add("terminal-preview--error");
      preview.textContent = validation.error;
      return;
    }
    preview.classList.remove("terminal-preview--error");
    preview.innerHTML = ansi.toHtml(renderSpec(validation.spec, width, ansiTheme).join("\n"));
  }

  function render(): void {
    renderEditor();
    renderPreview();
  }

  render();
  return app;
}

const meta: Meta<DashboardArgs> = {
  title: "JSON UI/Configurable dashboard",
  args: { width: 80 },
  argTypes: {
    width: { control: { type: "range", min: 40, max: 160, step: 1 } },
  },
  render: createDashboard,
};

export default meta;
type Story = StoryObj<DashboardArgs>;

export const Builder: Story = {};
