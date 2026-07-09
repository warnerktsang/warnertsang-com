import { afterEach, describe, expect, it, vi } from "vitest";

// Mock persistence + audit so the executor can be tested without a database.
// vi.mock is hoisted, so shared mocks must be created via vi.hoisted.
const { toolCallCreate, toolCallUpdate, recordAudit } = vi.hoisted(() => ({
  toolCallCreate: vi.fn(async () => ({ id: "tc_1" })),
  toolCallUpdate: vi.fn(async () => ({})),
  recordAudit: vi.fn(async () => {}),
}));
vi.mock("@/lib/db", () => ({
  prisma: {
    toolCall: { create: toolCallCreate, update: toolCallUpdate },
  },
}));
vi.mock("@/lib/audit", () => ({ recordAudit }));

import { toolExecutor } from "@/connectors/executor";
import type { ToolContext } from "@/connectors/types";

function ctx(): ToolContext {
  return { userId: "u1", getAccessToken: vi.fn(async () => "token") };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("ToolExecutor", () => {
  it("fails closed on an unknown tool and audits the error", async () => {
    const res = await toolExecutor.execute("nope.does_not_exist", {}, ctx());
    expect(res.ok).toBe(false);
    expect(recordAudit).toHaveBeenCalledWith(
      expect.objectContaining({ type: "error", success: false }),
    );
    expect(toolCallCreate).not.toHaveBeenCalled();
  });

  it("rejects invalid tool input before running the tool", async () => {
    const res = await toolExecutor.execute(
      "google_calendar.read_events",
      { start: "only-start" },
      ctx(),
    );
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/Invalid tool input/);
  });

  it("records a successful tool_call and audit event", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify({ items: [] }), { status: 200 }),
      ),
    );
    const res = await toolExecutor.execute(
      "google_calendar.read_events",
      { start: "2026-07-08T00:00:00Z", end: "2026-07-09T00:00:00Z" },
      ctx(),
    );
    expect(res.ok).toBe(true);
    expect(toolCallCreate).toHaveBeenCalledTimes(1);
    expect(toolCallUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "tc_1" },
        data: expect.objectContaining({ status: "success" }),
      }),
    );
    expect(recordAudit).toHaveBeenCalledWith(
      expect.objectContaining({ type: "tool_execution", success: true }),
    );
  });

  it("captures tool failures as structured errors (fail closed)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("nope", { status: 403 })),
    );
    const res = await toolExecutor.execute(
      "google_calendar.read_events",
      { start: "2026-07-08T00:00:00Z", end: "2026-07-09T00:00:00Z" },
      ctx(),
    );
    expect(res.ok).toBe(false);
    expect(toolCallUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "error" }),
      }),
    );
  });
});
