import type { Connector, ConnectorTool } from "@/connectors/types";
import { qualifiedToolName } from "@/connectors/types";
import { googleCalendarConnector } from "@/connectors/google/calendar";

export interface RegisteredTool {
  connector: Connector;
  tool: ConnectorTool;
  qualifiedName: string;
}

/**
 * In-memory registry of available connectors. This is the single source of
 * truth for what the agent can do; the `connectors` DB table is seeded from it
 * for observability.
 */
export class ConnectorRegistry {
  private connectors = new Map<string, Connector>();

  register(connector: Connector): void {
    if (this.connectors.has(connector.name)) {
      throw new Error(`Connector already registered: ${connector.name}`);
    }
    this.connectors.set(connector.name, connector);
  }

  get(name: string): Connector | undefined {
    return this.connectors.get(name);
  }

  all(): Connector[] {
    return [...this.connectors.values()];
  }

  /** Flat list of every tool across all connectors. */
  allTools(): RegisteredTool[] {
    const out: RegisteredTool[] = [];
    for (const connector of this.connectors.values()) {
      for (const tool of connector.tools) {
        out.push({
          connector,
          tool,
          qualifiedName: qualifiedToolName(connector.name, tool.name),
        });
      }
    }
    return out;
  }

  findTool(qualifiedName: string): RegisteredTool | undefined {
    return this.allTools().find((t) => t.qualifiedName === qualifiedName);
  }
}

export const registry = new ConnectorRegistry();

// --- Register connectors here (only google_calendar in Phase 1) ---
registry.register(googleCalendarConnector);
