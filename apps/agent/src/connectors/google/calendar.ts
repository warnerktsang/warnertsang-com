import { z } from "zod";
import type { Connector } from "@/connectors/types";
import { defineTool } from "@/connectors/types";
import {
  CALENDAR_READONLY_SCOPE,
  GOOGLE_PROVIDER,
  listCalendarEvents,
} from "@/connectors/google/client";

const readEventsInput = z.object({
  start: z
    .string()
    .describe(
      "Start of the time window as an ISO 8601 timestamp (e.g. 2026-07-08T00:00:00Z).",
    ),
  end: z
    .string()
    .describe(
      "End of the time window as an ISO 8601 timestamp (e.g. 2026-07-09T00:00:00Z).",
    ),
});

const readEventsTool = defineTool({
  name: "read_events",
  description:
    "Read the user's Google Calendar events between two timestamps. Returns event title, start, end, and (when present) location and description. Read-only.",
  inputSchema: readEventsInput,
  async execute(input: z.infer<typeof readEventsInput>, ctx) {
    const accessToken = await ctx.getAccessToken(GOOGLE_PROVIDER);
    const events = await listCalendarEvents({
      accessToken,
      timeMin: new Date(input.start).toISOString(),
      timeMax: new Date(input.end).toISOString(),
    });
    return { count: events.length, events };
  },
});

export const googleCalendarConnector: Connector = {
  name: "google_calendar",
  displayName: "Google Calendar",
  description:
    "Read-only access to your Google Calendar. Answers questions about upcoming events, availability, and schedule.",
  provider: GOOGLE_PROVIDER,
  oauthScopes: [CALENDAR_READONLY_SCOPE],
  tools: [readEventsTool],
};
