import { standardComponentDefinitions } from "@json-render/ink/catalog";

/**
 * Guard the adapter's constrained vocabulary against the pinned upstream Ink
 * catalog. Prop contracts are intentionally narrower because Pi tool results
 * are static and transcript-sized.
 */
export function assertUpstreamComponents(componentNames: readonly string[]): void {
  for (const name of componentNames) {
    if (!(name in standardComponentDefinitions)) {
      throw new Error(`json-render Ink no longer defines component "${name}".`);
    }
  }
}
