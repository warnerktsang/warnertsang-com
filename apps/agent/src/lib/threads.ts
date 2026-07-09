import "server-only";
import type { UIMessage } from "ai";
import { prisma } from "@/lib/db";

export function uiMessageToText(message: UIMessage): string {
  return message.parts
    .filter((p): p is { type: "text"; text: string } => p.type === "text")
    .map((p) => p.text)
    .join("\n")
    .trim();
}

export async function listThreads(userId: string) {
  return prisma.chatThread.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    select: { id: true, title: true, updatedAt: true },
  });
}

export async function createThread(userId: string, title = "New chat") {
  return prisma.chatThread.create({
    data: { userId, title },
    select: { id: true, title: true, updatedAt: true },
  });
}

/** Fetch a thread only if it belongs to the user (ownership check). */
export async function getOwnedThread(userId: string, threadId: string) {
  return prisma.chatThread.findFirst({ where: { id: threadId, userId } });
}

export async function getThreadMessages(userId: string, threadId: string) {
  const thread = await getOwnedThread(userId, threadId);
  if (!thread) return null;
  const messages = await prisma.chatMessage.findMany({
    where: { threadId },
    orderBy: { createdAt: "asc" },
  });
  return messages;
}

export async function deleteThread(userId: string, threadId: string) {
  // deleteMany scopes by userId so a user can't delete others' threads.
  const res = await prisma.chatThread.deleteMany({
    where: { id: threadId, userId },
  });
  return res.count > 0;
}

interface PersistMessageInput {
  threadId: string;
  role: string;
  message: UIMessage;
}

export async function persistMessage({
  threadId,
  role,
  message,
}: PersistMessageInput) {
  await prisma.chatMessage.create({
    data: {
      threadId,
      role,
      content: uiMessageToText(message),
      parts: message.parts as object,
    },
  });
  await prisma.chatThread.update({
    where: { id: threadId },
    data: { updatedAt: new Date() },
  });
}

/** Derive a short thread title from the first user message. */
export async function maybeSetThreadTitle(threadId: string, text: string) {
  const thread = await prisma.chatThread.findUnique({
    where: { id: threadId },
    select: { title: true },
  });
  if (!thread || thread.title !== "New chat") return;
  const title = text.replace(/\s+/g, " ").trim().slice(0, 60) || "New chat";
  await prisma.chatThread.update({ where: { id: threadId }, data: { title } });
}
