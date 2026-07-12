import { McpServer, createMcpHandler } from "@modelcontextprotocol/server";
import { z } from "zod";
import { recordAudit } from "@/lib/audit";
import {
  MCP_SERVER_NAME,
  MCP_SERVER_VERSION,
  MCP_TOOL_GET_STATUS,
} from "@/lib/mcp/constants";
import {
  financeImportSchema,
  importFinanceStatement,
} from "@/lib/mcp/finance";
import { listFinanceProviders } from "@/lib/finance/providers";
import { getAgentStatus } from "@/lib/mcp/status";
import { logMcpEvent } from "@/lib/mcp/log";

const emptyInput = z.object({}).strict();

export function createAgentOsMcpHandler() {
  return createMcpHandler(({ authInfo }) => {
    const server = new McpServer({
      name: MCP_SERVER_NAME,
      version: MCP_SERVER_VERSION,
    });

    server.registerTool(
      MCP_TOOL_GET_STATUS,
      {
        description: "Return the Agent OS health and version.",
        inputSchema: emptyInput,
      },
      async () => {
        const status = getAgentStatus();
        logMcpEvent({
          event: "tool",
          tool: MCP_TOOL_GET_STATUS,
          clientId: authInfo?.clientId ?? null,
          status: 200,
        });
        await recordAudit({
          type: "mcp_status",
          action: "Returned agent_os.get_status",
          success: true,
          metadata: {
            clientId: authInfo?.clientId ?? null,
            status: status.status,
            version: status.version,
          },
        });
        return {
          content: [{ type: "text", text: JSON.stringify(status) }],
        };
      },
    );

    server.registerTool(
      "finance.import_statement",
      {
        description: "Normalize a read-only finance statement into provider-agnostic data.",
        inputSchema: financeImportSchema,
      },
      async (input) => {
        const parsed = await importFinanceStatement(input);
        logMcpEvent({
          event: "tool",
          tool: "finance.import_statement",
          clientId: authInfo?.clientId ?? null,
          status: 200,
        });
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(parsed),
            },
          ],
        };
      },
    );

    server.registerTool(
      "finance.list_providers",
      {
        description: "List the supported finance providers and capabilities.",
        inputSchema: emptyInput,
      },
      async () => {
        const providers = listFinanceProviders();
        logMcpEvent({
          event: "tool",
          tool: "finance.list_providers",
          clientId: authInfo?.clientId ?? null,
          status: 200,
        });
        await recordAudit({
          type: "mcp_status",
          action: "Returned finance.list_providers",
          success: true,
          metadata: {
            clientId: authInfo?.clientId ?? null,
            providers: providers.map((provider) => provider.source),
          },
        });
        return {
          content: [{ type: "text", text: JSON.stringify({ providers }) }],
        };
      },
    );

    return server;
  });
}

export const agentOsMcpHandler = createAgentOsMcpHandler();
