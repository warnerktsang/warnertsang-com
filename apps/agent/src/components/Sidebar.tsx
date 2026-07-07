"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signOutAction } from "@/app/actions";

export interface ThreadSummary {
  id: string;
  title: string;
}

export function Sidebar({
  threads,
  activeThreadId,
  userEmail,
}: {
  threads: ThreadSummary[];
  activeThreadId?: string;
  userEmail: string;
}) {
  const router = useRouter();

  async function handleDelete(id: string) {
    const res = await fetch(`/api/threads/${id}`, { method: "DELETE" });
    if (res.ok) {
      if (id === activeThreadId) router.push("/chat");
      else router.refresh();
    }
  }

  return (
    <aside className="flex w-64 shrink-0 flex-col border-r border-black/10 dark:border-white/15">
      <div className="p-3">
        <Link
          href="/chat"
          className="block rounded-lg bg-foreground px-3 py-2 text-center text-sm font-medium text-background hover:opacity-90"
        >
          + New chat
        </Link>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-2">
        {threads.length === 0 && (
          <p className="px-2 py-4 text-xs text-black/40 dark:text-white/40">
            No conversations yet.
          </p>
        )}
        {threads.map((t) => (
          <div
            key={t.id}
            className={`group flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm ${
              t.id === activeThreadId
                ? "bg-black/[0.06] dark:bg-white/[0.08]"
                : "hover:bg-black/[0.04] dark:hover:bg-white/[0.05]"
            }`}
          >
            <Link href={`/chat/${t.id}`} className="flex-1 truncate">
              {t.title}
            </Link>
            <button
              type="button"
              onClick={() => handleDelete(t.id)}
              aria-label="Delete conversation"
              className="opacity-0 transition-opacity group-hover:opacity-100 text-black/40 hover:text-red-600 dark:text-white/40"
            >
              ×
            </button>
          </div>
        ))}
      </nav>

      <div className="space-y-2 border-t border-black/10 p-3 text-xs dark:border-white/15">
        <Link
          href="/admin"
          className="block rounded-lg px-2 py-1.5 hover:bg-black/[0.04] dark:hover:bg-white/[0.05]"
        >
          Admin
        </Link>
        <div className="truncate px-2 text-black/40 dark:text-white/40">
          {userEmail}
        </div>
        <form action={signOutAction}>
          <button
            type="submit"
            className="w-full rounded-lg px-2 py-1.5 text-left hover:bg-black/[0.04] dark:hover:bg-white/[0.05]"
          >
            Sign out
          </button>
        </form>
      </div>
    </aside>
  );
}
