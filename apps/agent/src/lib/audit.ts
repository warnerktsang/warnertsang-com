import "server-only";
import { prisma } from "@/lib/db";

export type AuditType =
  | "login"
  | "login_denied"
  | "connector_access"
  | "tool_execution"
  | "mcp_auth"
  | "mcp_auth_denied"
  | "mcp_authorization"
  | "mcp_status"
  | "error";

export interface AuditInput {
  userId?: string | null;
  type: AuditType;
  action: string;
  connector?: string | null;
  tool?: string | null;
  success?: boolean;
  metadata?: Record<string, unknown> | null;
}

// Keys whose values must never be persisted to the audit trail.
const SENSITIVE_KEY = /token|secret|password|api[_-]?key|authorization|refresh/i;

/**
 * Defense-in-depth: strip any token/secret-like fields before writing metadata.
 * Callers are expected not to pass secrets, but we scrub regardless.
 */
export function sanitizeMetadata(value: unknown, depth = 0): unknown {
  if (depth > 6 || value == null) return value;
  if (Array.isArray(value)) {
    return value.map((v) => sanitizeMetadata(v, depth + 1));
  }
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (SENSITIVE_KEY.test(k)) {
        out[k] = "[redacted]";
      } else {
        out[k] = sanitizeMetadata(v, depth + 1);
      }
    }
    return out;
  }
  return value;
}

/**
 * Append a record to the audit trail. Never throws into the caller path — audit
 * failures are logged but must not break the primary request.
 */
export async function recordAudit(input: AuditInput): Promise<void> {
  try {
    await prisma.auditEvent.create({
      data: {
        userId: input.userId ?? null,
        type: input.type,
        action: input.action,
        connector: input.connector ?? null,
        tool: input.tool ?? null,
        success: input.success ?? true,
        metadata: input.metadata
          ? (sanitizeMetadata(input.metadata) as object)
          : undefined,
      },
    });
  } catch (err) {
    console.error("[audit] failed to record audit event", err);
  }
}
