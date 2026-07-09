import "server-only";
import { prisma } from "@/lib/db";
import { registry } from "@/connectors/registry";
import { tokenStore } from "@/connectors/token-store";

/**
 * Persist connector configuration from the in-code registry into the DB
 * (idempotent). The registry is the source of truth; the table exists for
 * observability and future per-connector settings.
 */
export async function syncConnectors(): Promise<void> {
  for (const c of registry.all()) {
    await prisma.connector.upsert({
      where: { name: c.name },
      create: {
        name: c.name,
        displayName: c.displayName,
        description: c.description,
        provider: c.provider,
        scopes: c.oauthScopes,
      },
      update: {
        displayName: c.displayName,
        description: c.description,
        provider: c.provider,
        scopes: c.oauthScopes,
      },
    });
  }
}

export interface ConnectorStatus {
  name: string;
  displayName: string;
  description: string;
  provider: string;
  scopes: string[];
  connected: boolean;
}

export async function getConnectorStatuses(
  userId: string,
): Promise<ConnectorStatus[]> {
  const statuses: ConnectorStatus[] = [];
  for (const c of registry.all()) {
    const token = await tokenStore.get(userId, c.provider);
    const scope = token?.scope ?? "";
    const connected = Boolean(
      token?.accessToken && c.oauthScopes.every((s) => scope.includes(s)),
    );
    statuses.push({
      name: c.name,
      displayName: c.displayName,
      description: c.description,
      provider: c.provider,
      scopes: c.oauthScopes,
      connected,
    });
  }
  return statuses;
}
