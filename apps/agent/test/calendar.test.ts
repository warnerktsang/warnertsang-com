import { afterEach, describe, expect, it, vi } from "vitest";
import { listCalendarEvents } from "@/connectors/google/client";
import { googleCalendarConnector } from "@/connectors/google/calendar";
import type { ToolContext } from "@/connectors/types";

function mockFetch(status: number, body: unknown) {
  return vi.fn(async () =>
    new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    }),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

const sampleResponse = {
  items: [
    {
      summary: "Standup",
      status: "confirmed",
      location: "Zoom",
      start: { dateTime: "2026-07-08T09:00:00Z" },
      end: { dateTime: "2026-07-08T09:15:00Z" },
    },
    {
      summary: "All hands",
      status: "confirmed",
      start: { date: "2026-07-09" },
      end: { date: "2026-07-10" },
    },
    {
      summary: "Cancelled thing",
      status: "cancelled",
      start: { dateTime: "2026-07-08T12:00:00Z" },
      end: { dateTime: "2026-07-08T12:30:00Z" },
    },
  ],
};

describe("listCalendarEvents", () => {
  it("maps events, marks all-day, and drops cancelled events", async () => {
    vi.stubGlobal("fetch", mockFetch(200, sampleResponse));
    const events = await listCalendarEvents({
      accessToken: "token",
      timeMin: "2026-07-08T00:00:00Z",
      timeMax: "2026-07-10T00:00:00Z",
    });

    expect(events).toHaveLength(2);
    expect(events[0]).toMatchObject({
      title: "Standup",
      location: "Zoom",
      allDay: false,
    });
    expect(events[1]).toMatchObject({ title: "All hands", allDay: true });
  });

  it("fails closed on a 403 from Google", async () => {
    vi.stubGlobal("fetch", mockFetch(403, { error: "forbidden" }));
    await expect(
      listCalendarEvents({
        accessToken: "token",
        timeMin: "2026-07-08T00:00:00Z",
        timeMax: "2026-07-10T00:00:00Z",
      }),
    ).rejects.toThrow(/denied/i);
  });
});

describe("google_calendar.read_events tool", () => {
  it("requests an access token and returns mapped events", async () => {
    vi.stubGlobal("fetch", mockFetch(200, sampleResponse));
    const getAccessToken = vi.fn(async () => "token");
    const ctx: ToolContext = { userId: "u1", getAccessToken };

    const tool = googleCalendarConnector.tools.find(
      (t) => t.name === "read_events",
    )!;
    const result = (await tool.execute(
      { start: "2026-07-08T00:00:00Z", end: "2026-07-10T00:00:00Z" },
      ctx,
    )) as { count: number };

    expect(getAccessToken).toHaveBeenCalledWith("google");
    expect(result.count).toBe(2);
  });
});
