import type { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth-guard";
import { deleteThread, getThreadMessages } from "@/lib/threads";

export const runtime = "nodejs";

interface Context {
  params: Promise<{ id: string }>;
}

export async function GET(_req: NextRequest, ctx: Context) {
  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  const { id } = await ctx.params;
  const messages = await getThreadMessages(user.id, id);
  if (messages === null) return new Response("Not Found", { status: 404 });
  return Response.json({ messages });
}

export async function DELETE(_req: NextRequest, ctx: Context) {
  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  const { id } = await ctx.params;
  const ok = await deleteThread(user.id, id);
  if (!ok) return new Response("Not Found", { status: 404 });
  return new Response(null, { status: 204 });
}
