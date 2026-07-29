import type { Meta, StoryObj } from "@storybook/html-vite";
import Convert from "ansi-to-html";

import agentPlan from "../examples/agent-plan.json";
import deploymentStatus from "../examples/deployment-status.json";
import detailedAgentPlan from "../examples/detailed-agent-plan.json";
import { ansiTheme } from "../src/dev/theme.ts";
import { renderSpec } from "../src/renderer.ts";
import { validateSpec } from "../src/spec.ts";

interface PreviewArgs {
  width: number;
  spec: unknown;
}

const ansi = new Convert({
  bg: "#111613",
  fg: "#d8e2da",
  newline: true,
  escapeXML: true,
  colors: {
    1: "#ff6b6b",
    2: "#77d68c",
    3: "#efc96b",
    4: "#65a7ff",
    5: "#d993ff",
    6: "#58d7cf",
    7: "#d8e2da",
    8: "#748078",
  },
});

const meta: Meta<PreviewArgs> = {
  title: "JSON UI/Curated examples",
  tags: ["autodocs"],
  args: { width: 80 },
  argTypes: {
    width: {
      control: { type: "range", min: 40, max: 160, step: 1 },
      description: "Terminal width in columns",
    },
    spec: { table: { disable: true } },
  },
  render: ({ spec, width }) => {
    const validation = validateSpec(spec);
    const shell = document.createElement("main");
    shell.className = "preview-shell";

    const eyebrow = document.createElement("div");
    eyebrow.className = "preview-eyebrow";
    eyebrow.textContent = `${width} columns · live renderer`;

    const terminal = document.createElement("pre");
    terminal.className = "terminal-preview";
    terminal.style.setProperty("--terminal-columns", String(width));
    terminal.setAttribute("aria-label", `Terminal rendering at ${width} columns`);

    if (!validation.ok) {
      terminal.classList.add("terminal-preview--error");
      terminal.textContent = validation.error;
    } else {
      terminal.innerHTML = ansi.toHtml(renderSpec(validation.spec, width, ansiTheme).join("\n"));
    }

    shell.append(eyebrow, terminal);
    return shell;
  },
};

export default meta;
type Story = StoryObj<PreviewArgs>;

export const DeploymentStatus: Story = {
  args: { spec: deploymentStatus },
};

export const AgentPlan: Story = {
  args: { spec: agentPlan },
};

export const DetailedAgentPlan: Story = {
  args: { spec: detailedAgentPlan, width: 120 },
};
