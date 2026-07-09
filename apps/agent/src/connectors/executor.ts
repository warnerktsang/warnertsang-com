import "server-only";
import { prisma } from "@/lib/db";
import { recordAudit } from "@/lib/audit";
import type { ToolContext } from "@/connectors/types";
import { registry } from "@/connectors/registry";

export type ToolResult<T = unknown> =
  | { ok: true; data: T }
  | { ok: false; error: string };

/**
 * ToolExecutor
 * ------------
 * The single choke point for running a connector tool. Responsibilities:
 *  - validate the tool exists (fail closed on unknown tools),
 *  - persist a `tool_calls` row (running -> success | error),
 *  - emit `audit_events`,
 *  - never throw into the model path — errors are returned as structured
 *    results so the assistant can honestly report the failure.
 */
export class ToolExecutor {
  async execute<T = unknown>(
    qualifiedName: string,
    input: unknown,
    ctx: ToolContext,
  ): Promise<ToolResult<T>> {
    const registered = registry.findTool(qualifiedName);
    if (!registered) {
      await recordAudit({
        userId: ctx.userId,
        type: "error",
        action: `Unknown tool requested: ${qualifiedName}`,
        success: false,
      });
      return { ok: false, error: `Unknown tool: ${qualifiedName}` };
    }

    const { connector, tool } = registered;

    // Validate input against the tool schema (fail closed on bad input).
    const parsed = tool.inputSchema.safeParse(input);
    if (!parsed.success) {
      const message = parsed.error.issues
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join("; ");
      await this.recordFailure(ctx, connector.name, tool.name, input, message);
      return { ok: false, error: `Invalid tool input: ${message}` };
    }

    const call = await prisma.toolCall.create({
      data: {
        userId: ctx.userId,
        threadId: ctx.threadId ?? null,
        connector: connector.name,
        tool: tool.name,
        status: "running",
        input: parsed.data as object,
      },
    });

    const start = Date.now();
    try {
      const data = (await tool.execute(parsed.data, ctx)) as T;
      const durationMs = Date.now() - start;

      await prisma.toolCall.update({
        where: { id: call.id },
        data: {
          status: "success",
          output: data as object,
          durationMs,
          completedAt: new Date(),
        },
      });
      await recordAudit({
        userId: ctx.userId,
        type: "tool_execution",
        action: `Executed ${qualifiedName}`,
        connector: connector.name,
        tool: tool.name,
        success: true,
        metadata: { durationMs, toolCallId: call.id },
      });

      return { ok: true, data };
    } catch (err) {
      const durationMs = Date.now() - start;
      const message = err instanceof Error ? err.message : String(err);
      await prisma.toolCall.update({
        where: { id: call.id },
        data: {
          status: "error",
          error: message,
          durationMs,
          completedAt: new Date(),
        },
      });
      await recordAudit({
        userId: ctx.userId,
        type: "tool_execution",
        action: `Failed ${qualifiedName}`,
        connector: connector.name,
        tool: tool.name,
        success: false,
        metadata: { durationMs, toolCallId: call.id, error: message },
      });
      return { ok: false, error: message };
    }
  }

  private async recordFailure(
    ctx: ToolContext,
    connector: string,
    tool: string,
    input: unknown,
    message: string,
  ): Promise<void> {
    await prisma.toolCall.create({
      data: {
        userId: ctx.userId,
        threadId: ctx.threadId ?? null,
        connector,
        tool,
        status: "error",
        input: input as object,
        error: message,
        completedAt: new Date(),
      },
    });
    await recordAudit({
      userId: ctx.userId,
      type: "tool_execution",
      action: `Rejected ${connector}.${tool}`,
      connector,
      tool,
      success: false,
      metadata: { error: message },
    });
  }
}

export const toolExecutor = new ToolExecutor();
