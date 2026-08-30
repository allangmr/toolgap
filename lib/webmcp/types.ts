export interface McpTextContent {
  type: "text";
  text: string;
}

export interface McpToolResult {
  content: McpTextContent[];
  isError?: boolean;
}

export interface NativeToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  annotations?: { readOnlyHint?: boolean };
  execute: (params: Record<string, unknown>) => Promise<McpToolResult>;
}

export interface WebmcpAdapter {
  kind: "native" | "polyfill" | "noop";
  available: boolean;
  register(def: NativeToolDefinition): void;
  unregister(name: string): void;
}

export type ToolHandler = (
  params: Record<string, unknown>,
) => Promise<unknown> | unknown;

// Native WebMCP types come from @mcp-b/webmcp-types when the polyfill is installed.
// Avoid re-declaring Navigator.modelContext to prevent modifier conflicts.

