import { McpServer, createMcpHandler } from "@modelcontextprotocol/server";
import { z } from "zod";
import { recordAudit } from "@/lib/audit";
import {
  MCP_SERVER_NAME,
  MCP_SERVER_VERSION,
  MCP_TOOL_GET_STATUS,
} from "@/lib/mcp/constants";
import {
  importWealthfrontQfx,
  wealthfrontImportSchema,
} from "@/lib/mcp/wealthfront";
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
      "wealthfront.import_qfx",
      {
        description: "Parse a Wealthfront Quicken export into normalized finance data.",
        inputSchema: wealthfrontImportSchema,
      },
      async (input) => {
        const parsed = await importWealthfrontQfx(input);
        logMcpEvent({
          event: "tool",
          tool: "wealthfront.import_qfx",
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

    return server;
  });
}

export const agentOsMcpHandler = createAgentOsMcpHandler();
