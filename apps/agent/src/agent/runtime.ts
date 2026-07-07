import "server-only";
import { tool as aiTool } from "ai";
import type { ToolSet } from "ai";
import { registry } from "@/connectors/registry";
import { toolExecutor } from "@/connectors/executor";
import type { ToolContext } from "@/connectors/types";

/**
 * AI SDK tool names must match /^[a-zA-Z0-9_-]+$/, so the connector "." is
 * encoded as "__". The registry qualified name remains the audit source of
 * truth.
 */
export function aiToolName(qualifiedName: string): string {
  return qualifiedName.replace(/\./g, "__");
}

/**
 * Builds the AI SDK tool set from the connector registry. Each tool routes
 * through the ToolExecutor (audit + tool_calls + fail-closed error handling).
 * The model never touches a connector or third-party API directly.
 */
export function buildAgentTools(ctx: ToolContext): ToolSet {
  const tools: ToolSet = {};
  for (const { tool, qualifiedName } of registry.allTools()) {
    tools[aiToolName(qualifiedName)] = aiTool({
      description: tool.description,
      inputSchema: tool.inputSchema,
      execute: async (input) => {
        const result = await toolExecutor.execute(qualifiedName, input, ctx);
        // Return structured errors so the assistant reports failures honestly
        // instead of fabricating data.
        return result.ok ? result.data : { error: result.error };
      },
    });
  }
  return tools;
}

export function buildSystemPrompt(now: Date = new Date()): string {
  const connectorLines = registry
    .all()
    .map(
      (c) =>
        `- ${c.name}: ${c.description} Tools: ${c.tools
          .map((t) => t.name)
          .join(", ")}.`,
    )
    .join("\n");

  return [
    "You are a private, read-only personal assistant for a single user.",
    `The current date and time is ${now.toISOString()} (UTC). Resolve relative dates like "tomorrow" or "next week" against this.`,
    "",
    "Available connectors:",
    connectorLines,
    "",
    "Rules:",
    "- To answer anything about the user's calendar or schedule, you MUST call the google_calendar__read_events tool. Never guess or invent events.",
    "- Only state that you accessed calendar data if a tool actually returned it in this conversation.",
    "- If a tool returns an { error } object, clearly explain the limitation (e.g. account not connected, permission missing) and do not fabricate results.",
    "- You are strictly read-only: you cannot create, edit, or delete events. If asked to, explain that this is out of scope for the current phase.",
    "- Be concise. Format event lists clearly with times. Assume times are in the user's local calendar timezone as returned by the tool.",
  ].join("\n");
}
