import { z } from "zod";

/**
 * Connector framework
 * -------------------
 * A Connector is a self-describing integration (name, description, required
 * OAuth scopes, and the tools it exposes). The agent runtime never talks to a
 * third-party API directly; it goes through a tool -> executor -> connector.
 *
 * Adding a future connector = implement this interface and register it. No
 * changes to the agent runtime, chat route, or executor are required.
 */

export interface ToolContext {
  /** Internal user id (users.id). */
  userId: string;
  /** Optional chat thread the call originated from (for audit correlation). */
  threadId?: string | null;
  /**
   * Returns a valid (refreshed if needed) access token for an OAuth provider,
   * or throws if the user has not connected / granted the required scopes.
   * Tokens are fetched behind the TokenStore abstraction so callers never see
   * storage details.
   */
  getAccessToken: (provider: string) => Promise<string>;
}

export interface ConnectorTool<Input = unknown, Output = unknown> {
  /** Tool name, unique within its connector, e.g. "read_events". */
  name: string;
  description: string;
  /** Zod schema for tool inputs — also surfaced to the model. */
  inputSchema: z.ZodType<Input>;
  execute: (input: Input, ctx: ToolContext) => Promise<Output>;
}

export interface Connector {
  /** Stable machine name, e.g. "google_calendar". */
  name: string;
  displayName: string;
  description: string;
  /** OAuth provider this connector authenticates against, e.g. "google". */
  provider: string;
  /** OAuth scopes the connector requires. */
  oauthScopes: string[];
  tools: ConnectorTool[];
}

/** Fully-qualified tool name, e.g. "google_calendar.read_events". */
export function qualifiedToolName(connector: string, tool: string): string {
  return `${connector}.${tool}`;
}

/**
 * Helper to define a strongly-typed tool while erasing its generics for
 * storage in `Connector.tools`. Internally the definition is type-checked
 * against ConnectorTool<Input, Output>; the return type is the erased
 * ConnectorTool so heterogeneous tools can live in one array.
 */
export function defineTool<Input, Output>(
  def: ConnectorTool<Input, Output>,
): ConnectorTool {
  return def as unknown as ConnectorTool;
}
