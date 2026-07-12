import { describe, expect, it, vi } from "vitest";
import { authenticateMcpRequest, authorizeMcpRequest } from "@/lib/mcp/auth";

vi.mock("@/lib/audit", () => ({
  recordAudit: vi.fn(async () => {}),
}));

import { POST } from "@/app/api/mcp/route";

function authHeaders(token = "test-mcp-token") {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/json, text/event-stream",
    "MCP-Protocol-Version": "2025-06-18",
  };
}

describe("MCP auth helpers", () => {
  it("rejects requests without a bearer token", () => {
    const result = authenticateMcpRequest(new Request("http://test/api/mcp"));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.response.status).toBe(401);
  });

  it("accepts the configured bearer token", () => {
    const result = authenticateMcpRequest(
      new Request("http://test/api/mcp", {
        headers: authHeaders(),
      }),
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.authInfo.clientId).toBe("claude");
      expect(result.authInfo.scopes).toContain("agent_os.read");
    }
  });

  it("rejects callers without the read scope", () => {
    const result = authorizeMcpRequest({
      clientId: "example",
      scopes: [],
      token: "token",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.response.status).toBe(403);
  });
});

describe("MCP route", () => {
  it("rejects unauthenticated requests", async () => {
    const response = await POST(
      new Request("http://test/api/mcp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "initialize",
          params: {
            protocolVersion: "2025-06-18",
            capabilities: {},
            clientInfo: {
              name: "TestClient",
              version: "1.0.0",
            },
          },
        }),
      }),
    );

    expect(response.status).toBe(401);
  });

  it("serves the MCP initialize handshake when authenticated", async () => {
    const response = await POST(
      new Request("http://test/api/mcp", {
        method: "POST",
        headers: {
          ...authHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "initialize",
          params: {
            protocolVersion: "2025-06-18",
            capabilities: {},
            clientInfo: {
              name: "TestClient",
              version: "1.0.0",
            },
          },
        }),
      }),
    );

    expect(response.status).toBe(200);
    const body = await response.text();
    expect(body).toContain("agent-os");
    expect(body).toContain("0.1.0");
  });
});
