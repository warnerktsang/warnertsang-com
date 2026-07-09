import { requireUser } from "@/lib/auth-guard";
import { listThreads } from "@/lib/threads";
import { Sidebar } from "@/components/Sidebar";
import { ChatShell } from "@/components/ChatShell";

export const dynamic = "force-dynamic";

export default async function ChatPage() {
  const user = await requireUser();
  const threads = await listThreads(user.id);

  return (
    <div className="flex h-dvh">
      <Sidebar threads={threads} userEmail={user.email} />
      <ChatShell initialMessages={[]} />
    </div>
  );
}
