export interface McpLogEvent {
  event: string;
  method?: string;
  path?: string;
  clientId?: string | null;
  tool?: string;
  status?: number;
  reason?: string;
  requestId?: string;
}

export function logMcpEvent(event: McpLogEvent): void {
  console.info(JSON.stringify({ source: "mcp", ...event }));
}
