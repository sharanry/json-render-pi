import { visibleWidth } from "@earendil-works/pi-tui";

import type { JsonRenderSpec } from "../spec.ts";

export type DesignFindingLevel = "error" | "warning" | "advice";

export interface DesignFinding {
  level: DesignFindingLevel;
  code: string;
  message: string;
  elementId?: string;
}

/**
 * Heuristics for inline transcript UI. Validation guarantees correctness;
 * these findings target scanability, density, and responsive terminal layout.
 */
export function auditDesign(
  spec: JsonRenderSpec,
  renderedLines: readonly string[],
  width: number,
): DesignFinding[] {
  const findings: DesignFinding[] = [];

  const overflow = renderedLines.findIndex((line) => visibleWidth(line) > width);
  if (overflow >= 0) {
    findings.push({
      level: "error",
      code: "line-overflow",
      message: `Rendered line ${overflow + 1} exceeds the ${width}-column viewport.`,
    });
  }

  const heightBudget = width >= 120 ? 36 : 24;
  if (renderedLines.length > heightBudget) {
    findings.push({
      level: "warning",
      code: "height-budget",
      message: `The UI is ${renderedLines.length} lines tall; keep this viewport within ${heightBudget} lines or split the content.`,
    });
  }

  let dividerCount = 0;
  let headingCount = 0;
  for (const [elementId, element] of Object.entries(spec.elements)) {
    switch (element.type) {
      case "Card":
        if (element.children.length > 6) {
          findings.push({
            level: "advice",
            code: "dense-card",
            elementId,
            message: `Card "${elementId}" has ${element.children.length} direct sections; aim for 6 or fewer.`,
          });
        }
        break;
      case "Box":
        if (element.props.flexDirection === "row") {
          for (const childId of element.children) {
            const child = spec.elements[childId];
            if (child && ["Text", "Callout", "List", "Table", "BarChart"].includes(child.type)) {
              findings.push({
                level: "warning",
                code: "prose-in-row",
                elementId,
                message: `Row "${elementId}" contains ${child.type}; rows should contain only compact metrics, badges, or key/value items.`,
              });
              break;
            }
          }
        }
        break;
      case "Table": {
        if (element.props.columns.length > 3) {
          findings.push({
            level: "advice",
            code: "wide-table",
            elementId,
            message: `Table "${elementId}" has ${element.props.columns.length} columns; 3 or fewer scan better at 80 columns.`,
          });
        }
        const proseCell = element.props.rows
          .flatMap((row) => Object.values(row))
          .find((cell) => cell.length > 60 && /[.!?](?:\s|$)/.test(cell));
        if (proseCell) {
          findings.push({
            level: "warning",
            code: "table-prose",
            elementId,
            message: `Table "${elementId}" contains paragraph-like text; use a List or Callout for prose.`,
          });
        }
        break;
      }
      case "List":
        if (element.props.items.length > 6) {
          findings.push({
            level: "advice",
            code: "long-list",
            elementId,
            message: `List "${elementId}" has ${element.props.items.length} items; prioritize the 6 most important.`,
          });
        }
        break;
      case "BarChart":
        if (element.props.data.length > 6) {
          findings.push({
            level: "advice",
            code: "busy-chart",
            elementId,
            message: `Bar chart "${elementId}" has ${element.props.data.length} bars; use 6 or fewer for quick comparison.`,
          });
        }
        break;
      case "Divider":
        dividerCount += 1;
        break;
      case "Heading":
        headingCount += 1;
        break;
    }
  }

  if (dividerCount > Math.max(2, headingCount)) {
    findings.push({
      level: "advice",
      code: "divider-overuse",
      message: `The UI uses ${dividerCount} dividers for ${headingCount} headings; whitespace and hierarchy usually provide cleaner separation.`,
    });
  }

  return findings;
}
