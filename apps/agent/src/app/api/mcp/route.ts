import { recordAudit } from "@/lib/audit";
import {
  authenticateMcpRequest,
  authorizeMcpRequest,
} from "@/lib/mcp/auth";
import { agentOsMcpHandler } from "@/lib/mcp/server";
import { logMcpEvent } from "@/lib/mcp/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function handleMcpRequest(request: Request): Promise<Response> {
  const url = new URL(request.url);
  logMcpEvent({
    event: "request",
    method: request.method,
    path: url.pathname,
  });

  const auth = authenticateMcpRequest(request);
  if (!auth.ok) {
    logMcpEvent({
      event: "auth",
      method: request.method,
      path: url.pathname,
      status: auth.response.status,
      reason: auth.reason,
    });
    await recordAudit({
      type: "mcp_auth_denied",
      action: `Rejected MCP request: ${auth.reason}`,
      success: false,
      metadata: {
        method: request.method,
        path: url.pathname,
        reason: auth.reason,
      },
    });
    return auth.response;
  }

  const authorization = authorizeMcpRequest(auth.authInfo);
  if (!authorization.ok) {
    logMcpEvent({
      event: "authorization",
      method: request.method,
      path: url.pathname,
      clientId: auth.authInfo.clientId,
      status: authorization.response.status,
      reason: authorization.reason,
    });
    await recordAudit({
      type: "mcp_authorization",
      action: `Denied MCP access: ${authorization.reason}`,
      success: false,
      metadata: {
        clientId: auth.authInfo.clientId,
        reason: authorization.reason,
      },
    });
    return authorization.response;
  }

  await recordAudit({
    type: "mcp_auth",
    action: "Authenticated MCP request",
    success: true,
    metadata: {
      clientId: auth.authInfo.clientId,
      method: request.method,
      path: url.pathname,
    },
  });

  return agentOsMcpHandler.fetch(request, { authInfo: auth.authInfo });
}

export async function GET(request: Request): Promise<Response> {
  return handleMcpRequest(request);
}

export async function POST(request: Request): Promise<Response> {
  return handleMcpRequest(request);
}
