import type { Surface } from "@/lib/shared/types";

/**
 * WebMCP surface of the page currently running this JS context.
 *
 * The tool registry and `document.modelContext` are shared per tab, so
 * store-surface dynamic capabilities must only be registered when the tab is
 * actually on the demo store. Otherwise a publish from the dashboard would
 * leak the store tool into the dashboard's WebMCP tool list.
 */
export function currentPageSurface(): Surface {
  if (typeof window === "undefined") return "dashboard";
  return window.location.pathname.startsWith("/store")
    ? "store"
    : "dashboard";
}
