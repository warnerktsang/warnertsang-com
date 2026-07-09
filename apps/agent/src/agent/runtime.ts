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

/**
 * Returns the user's current-local-day info for a given IANA timezone, so the
 * model resolves "today"/"tomorrow" against the user's local calendar day
 * rather than UTC. Falls back to UTC when the timezone is missing/invalid.
 */
function localTimeContext(now: Date, timeZone?: string): string {
  if (timeZone) {
    try {
      const local = new Intl.DateTimeFormat("en-US", {
        timeZone,
        dateStyle: "full",
        timeStyle: "long",
      }).format(now);
      const gmt =
        new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: "longOffset" })
          .formatToParts(now)
          .find((p) => p.type === "timeZoneName")?.value ?? "GMT";
      // "GMT-04:00" -> "-04:00"; bare "GMT" (UTC) -> "+00:00".
      const offset = gmt === "GMT" ? "+00:00" : gmt.replace("GMT", "");
      return [
        `The user's timezone is ${timeZone} (UTC offset ${offset}).`,
        `The current local date and time for the user is ${local}.`,
        `Resolve relative dates like "today", "tomorrow", or "next week" against the user's LOCAL date. When calling google_calendar__read_events, pass start/end as ISO 8601 timestamps that include the user's UTC offset (e.g. a full local day is 2026-07-08T00:00:00${offset} to 2026-07-09T00:00:00${offset}).`,
      ].join(" ");
    } catch {
      // Invalid timezone identifier — fall through to UTC.
    }
  }
  return `The current date and time is ${now.toISOString()} (UTC). Resolve relative dates like "tomorrow" or "next week" against this.`;
}

export function buildSystemPrompt(
  now: Date = new Date(),
  timeZone?: string,
): string {
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
    localTimeContext(now, timeZone),
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
