import { notFound } from "next/navigation";
import type { UIMessage } from "ai";
import { requireUser } from "@/lib/auth-guard";
import { getThreadMessages, listThreads } from "@/lib/threads";
import { Sidebar } from "@/components/Sidebar";
import { ChatShell } from "@/components/ChatShell";

export const dynamic = "force-dynamic";

export default async function ThreadPage({
  params,
}: {
  params: Promise<{ threadId: string }>;
}) {
  const user = await requireUser();
  const { threadId } = await params;

  const stored = await getThreadMessages(user.id, threadId);
  if (stored === null) notFound();

  const threads = await listThreads(user.id);
  const initialMessages: UIMessage[] = stored.map((m) => ({
    id: m.id,
    role: m.role as UIMessage["role"],
    parts: (m.parts ?? []) as UIMessage["parts"],
  }));

  return (
    <div className="flex h-dvh">
      <Sidebar
        threads={threads}
        activeThreadId={threadId}
        userEmail={user.email}
      />
      <ChatShell initialThreadId={threadId} initialMessages={initialMessages} />
    </div>
  );
}
