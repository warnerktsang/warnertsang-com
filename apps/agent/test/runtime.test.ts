import { describe, expect, it } from "vitest";
import { registry } from "@/connectors/registry";
import { sanitizeMetadata } from "@/lib/audit";
import { aiToolName, buildSystemPrompt } from "@/agent/runtime";

describe("connector registry", () => {
  it("exposes the google_calendar.read_events tool", () => {
    const names = registry.allTools().map((t) => t.qualifiedName);
    expect(names).toContain("google_calendar.read_events");
    expect(registry.findTool("google_calendar.read_events")).toBeDefined();
  });
});

describe("aiToolName", () => {
  it("encodes dots as double underscores for the model", () => {
    expect(aiToolName("google_calendar.read_events")).toBe(
      "google_calendar__read_events",
    );
  });
});

describe("buildSystemPrompt", () => {
  it("lists connectors and forbids fabricating calendar data", () => {
    const prompt = buildSystemPrompt(new Date("2026-07-07T00:00:00Z"));
    expect(prompt).toMatch(/google_calendar/);
    expect(prompt).toMatch(/read-only/i);
    expect(prompt).toMatch(/never guess|do not fabricate/i);
  });
});

describe("sanitizeMetadata", () => {
  it("redacts token/secret-like keys recursively", () => {
    const out = sanitizeMetadata({
      ok: "visible",
      access_token: "secret",
      nested: { refreshToken: "x", apiKey: "y", fine: 1 },
    }) as Record<string, unknown>;
    expect(out.ok).toBe("visible");
    expect(out.access_token).toBe("[redacted]");
    const nested = out.nested as Record<string, unknown>;
    expect(nested.refreshToken).toBe("[redacted]");
    expect(nested.apiKey).toBe("[redacted]");
    expect(nested.fine).toBe(1);
  });
});
