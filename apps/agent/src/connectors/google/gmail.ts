import { z } from "zod";
import type { Connector } from "@/connectors/types";
import { defineTool } from "@/connectors/types";
import {
  GMAIL_READONLY_SCOPE,
  GOOGLE_PROVIDER,
  searchGmailMessages,
  getGmailMessage,
} from "@/connectors/google/client";

const searchMessagesInput = z.object({
  query: z
    .string()
    .describe(
      "Gmail search query string using Gmail syntax, e.g. \"from:alice subject:invoice after:2026/01/01\", \"is:unread label:inbox\", \"has:attachment\".",
    ),
  maxResults: z
    .number()
    .int()
    .min(1)
    .max(50)
    .optional()
    .describe("Maximum number of messages to return (default 20, max 50)."),
});

const searchMessagesTool = defineTool({
  name: "search_messages",
  description:
    "Search the user's Gmail using a Gmail search query. Returns message metadata (subject, from, to, date, snippet). Use get_message to retrieve the full body of a specific email. Read-only.",
  inputSchema: searchMessagesInput,
  async execute(input: z.infer<typeof searchMessagesInput>, ctx) {
    const accessToken = await ctx.getAccessToken(GOOGLE_PROVIDER);
    const messages = await searchGmailMessages({
      accessToken,
      query: input.query,
      maxResults: input.maxResults,
    });
    return { count: messages.length, messages };
  },
});

const getMessageInput = z.object({
  id: z
    .string()
    .describe("The Gmail message ID returned by search_messages."),
});

const getMessageTool = defineTool({
  name: "get_message",
  description:
    "Fetch the full content of a single Gmail message by its ID, including the decoded plain-text body, subject, sender, recipient, and date. Use search_messages first to find the ID. Read-only.",
  inputSchema: getMessageInput,
  async execute(input: z.infer<typeof getMessageInput>, ctx) {
    const accessToken = await ctx.getAccessToken(GOOGLE_PROVIDER);
    const message = await getGmailMessage({ accessToken, id: input.id });
    if (!message) return { error: `Message ${input.id} not found.` };
    return { message };
  },
});

export const googleGmailConnector: Connector = {
  name: "google_gmail",
  displayName: "Gmail",
  description:
    "Read-only access to your Gmail. Search messages, read emails, and retrieve full message content.",
  provider: GOOGLE_PROVIDER,
  oauthScopes: [GMAIL_READONLY_SCOPE],
  tools: [searchMessagesTool, getMessageTool],
};
