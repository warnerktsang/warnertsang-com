import { convertToModelMessages, stepCountIs, streamText } from "ai";
import type { UIMessage } from "ai";
import { getCurrentUser } from "@/lib/auth-guard";
import {
  getOwnedThread,
  maybeSetThreadTitle,
  persistMessage,
  uiMessageToText,
} from "@/lib/threads";
import { getAgentModel } from "@/agent/model";
import { buildAgentTools, buildSystemPrompt } from "@/agent/runtime";
import { getGoogleAccessToken } from "@/connectors/google/client";
import type { ToolContext } from "@/connectors/types";
import { recordAudit } from "@/lib/audit";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const body = (await req.json()) as {
    messages?: UIMessage[];
    threadId?: string;
    timeZone?: string;
  };
  const { messages, threadId, timeZone } = body;
  if (!threadId || !Array.isArray(messages)) {
    return new Response("Bad Request", { status: 400 });
  }

  const thread = await getOwnedThread(user.id, threadId);
  if (!thread) return new Response("Not Found", { status: 404 });

  // Persist the incoming user message before doing any work.
  const last = messages[messages.length - 1];
  if (last?.role === "user") {
    await persistMessage({ threadId, role: "user", message: last });
    await maybeSetThreadTitle(threadId, uiMessageToText(last));
  }

  const ctx: ToolContext = {
    userId: user.id,
    threadId,
    getAccessToken: async (provider) => {
      if (provider === "google") return getGoogleAccessToken(user.id);
      throw new Error(`No token available for provider: ${provider}`);
    },
  };

  const result = streamText({
    model: getAgentModel(),
    system: buildSystemPrompt(new Date(), timeZone),
    messages: await convertToModelMessages(messages),
    tools: buildAgentTools(ctx),
    // Allow the model to call a tool then respond with the result.
    stopWhen: stepCountIs(5),
  });

  return result.toUIMessageStreamResponse({
    originalMessages: messages,
    onFinish: async ({ responseMessage }) => {
      await persistMessage({
        threadId,
        role: "assistant",
        message: responseMessage,
      });
    },
    onError: (error) => {
      const message =
        error instanceof Error ? error.message : "The assistant hit an error.";
      void recordAudit({
        userId: user.id,
        type: "error",
        action: "Chat generation error",
        success: false,
        metadata: { error: message, threadId },
      });
      return message;
    },
  });
}
