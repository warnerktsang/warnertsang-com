import { getCurrentUser } from "@/lib/auth-guard";
import { createThread, listThreads } from "@/lib/threads";

export const runtime = "nodejs";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  const threads = await listThreads(user.id);
  return Response.json({ threads });
}

export async function POST() {
  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  const thread = await createThread(user.id);
  return Response.json({ thread }, { status: 201 });
}
