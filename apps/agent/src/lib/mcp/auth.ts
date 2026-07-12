import type { AuthInfo } from "@modelcontextprotocol/server";
import { env } from "@/lib/env";
import { MCP_READ_SCOPE } from "@/lib/mcp/constants";

export interface McpAuthSuccess {
  ok: true;
  authInfo: AuthInfo;
}

export interface McpAuthFailure {
  ok: false;
  response: Response;
  reason: string;
}

export type McpAuthResult = McpAuthSuccess | McpAuthFailure;

export interface McpAuthorizationFailure {
  ok: false;
  response: Response;
  reason: string;
}

export type McpAuthorizationResult = { ok: true } | McpAuthorizationFailure;

function jsonError(status: number, reason: string): Response {
  return new Response(JSON.stringify({ error: reason }), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "WWW-Authenticate": 'Bearer realm="agent-os"',
    },
  });
}

function extractBearerToken(request: Request): string | null {
  const header = request.headers.get("authorization");
  if (!header) return null;
  const [scheme, ...rest] = header.trim().split(/\s+/);
  if (scheme.toLowerCase() !== "bearer") return null;
  const token = rest.join(" ").trim();
  return token || null;
}

export function authenticateMcpRequest(
  request: Request,
): McpAuthResult {
  const configuredToken = env.MCP_BEARER_TOKEN;
  if (!configuredToken) {
    return {
      ok: false,
      reason: "MCP bearer token is not configured",
      response: jsonError(503, "MCP bearer token is not configured"),
    };
  }

  const token = extractBearerToken(request);
  if (!token) {
    return {
      ok: false,
      reason: "Missing bearer token",
      response: jsonError(401, "Missing bearer token"),
    };
  }

  if (token !== configuredToken) {
    return {
      ok: false,
      reason: "Invalid bearer token",
      response: jsonError(401, "Invalid bearer token"),
    };
  }

  return {
    ok: true,
    authInfo: {
      clientId: "claude",
      scopes: [MCP_READ_SCOPE],
      token,
    },
  };
}

export function authorizeMcpRequest(
  authInfo: AuthInfo,
): McpAuthorizationResult {
  if (!authInfo.scopes.includes(MCP_READ_SCOPE)) {
    return {
      ok: false,
      reason: "Missing required scope: agent_os.read",
      response: jsonError(403, "Missing required scope: agent_os.read"),
    };
  }
  return { ok: true };
}
