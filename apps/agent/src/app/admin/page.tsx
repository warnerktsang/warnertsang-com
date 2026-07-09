import Link from "next/link";
import { requireUser } from "@/lib/auth-guard";
import { prisma } from "@/lib/db";
import { getConnectorStatuses, syncConnectors } from "@/lib/connectors-db";

export const dynamic = "force-dynamic";

function fmt(d: Date): string {
  return new Date(d).toLocaleString();
}

export default async function AdminPage() {
  const user = await requireUser();
  await syncConnectors();

  const [connectors, toolCalls, auditEvents] = await Promise.all([
    getConnectorStatuses(user.id),
    prisma.toolCall.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 25,
    }),
    prisma.auditEvent.findMany({
      orderBy: { createdAt: "desc" },
      take: 25,
    }),
  ]);

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 space-y-8 p-6">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Admin · Observability</h1>
        <Link
          href="/chat"
          className="text-sm text-black/60 hover:underline dark:text-white/60"
        >
          ← Back to chat
        </Link>
      </header>

      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-black/50 dark:text-white/50">
          Connectors
        </h2>
        <div className="grid gap-2 sm:grid-cols-2">
          {connectors.map((c) => (
            <div
              key={c.name}
              className="rounded-xl border border-black/10 p-3 dark:border-white/15"
            >
              <div className="flex items-center justify-between">
                <span className="font-medium">{c.displayName}</span>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs ${
                    c.connected
                      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300"
                      : "bg-black/[0.06] text-black/50 dark:bg-white/10 dark:text-white/50"
                  }`}
                >
                  {c.connected ? "connected" : "not connected"}
                </span>
              </div>
              <p className="mt-1 font-mono text-xs text-black/50 dark:text-white/50">
                {c.name}
              </p>
              <p className="mt-1 text-xs text-black/60 dark:text-white/60">
                scopes: {c.scopes.join(", ")}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-black/50 dark:text-white/50">
          Recent tool calls
        </h2>
        <AdminTable
          empty="No tool calls yet."
          head={["When", "Tool", "Status", "Duration"]}
          rows={toolCalls.map((t) => [
            fmt(t.createdAt),
            `${t.connector}.${t.tool}`,
            t.status,
            t.durationMs != null ? `${t.durationMs}ms` : "—",
          ])}
        />
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-black/50 dark:text-white/50">
          Recent audit events
        </h2>
        <AdminTable
          empty="No audit events yet."
          head={["When", "Type", "Action", "OK"]}
          rows={auditEvents.map((e) => [
            fmt(e.createdAt),
            e.type,
            e.action,
            e.success ? "yes" : "no",
          ])}
        />
      </section>
    </main>
  );
}

function AdminTable({
  head,
  rows,
  empty,
}: {
  head: string[];
  rows: string[][];
  empty: string;
}) {
  if (rows.length === 0) {
    return (
      <p className="text-sm text-black/40 dark:text-white/40">{empty}</p>
    );
  }
  return (
    <div className="overflow-x-auto rounded-xl border border-black/10 dark:border-white/15">
      <table className="w-full text-left text-sm">
        <thead className="bg-black/[0.03] text-xs uppercase text-black/50 dark:bg-white/[0.04] dark:text-white/50">
          <tr>
            {head.map((h) => (
              <th key={h} className="px-3 py-2 font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr
              key={i}
              className="border-t border-black/5 dark:border-white/10"
            >
              {r.map((cell, j) => (
                <td key={j} className="px-3 py-2 align-top">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
