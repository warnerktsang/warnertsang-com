"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import type { UIMessage } from "ai";
import { MessageView } from "@/components/MessageView";

const SUGGESTIONS = [
  "What's on my calendar tomorrow?",
  "What meetings do I have next week?",
  "What does my afternoon look like?",
  "When am I free this week?",
];

export function ChatShell({
  initialThreadId,
  initialMessages,
}: {
  initialThreadId?: string;
  initialMessages: UIMessage[];
}) {
  const router = useRouter();
  const [threadId, setThreadId] = useState<string | undefined>(initialThreadId);
  const [input, setInput] = useState("");

  const { messages, sendMessage, status, stop, error } = useChat({
    messages: initialMessages,
    transport: new DefaultChatTransport({ api: "/api/chat" }),
  });

  const busy = status === "submitted" || status === "streaming";

  async function ensureThreadId(): Promise<string> {
    if (threadId) return threadId;
    const res = await fetch("/api/threads", { method: "POST" });
    const { thread } = (await res.json()) as { thread: { id: string } };
    setThreadId(thread.id);
    // Update the URL without a full navigation (keeps chat state), then refresh
    // the server-rendered sidebar so the new thread appears.
    window.history.replaceState(null, "", `/chat/${thread.id}`);
    router.refresh();
    return thread.id;
  }

  async function submit(text: string) {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    setInput("");
    const id = await ensureThreadId();
    await sendMessage({ text: trimmed }, { body: { threadId: id } });
  }

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-2xl space-y-4 p-4">
          {messages.length === 0 && (
            <div className="mt-16 text-center">
              <h2 className="text-lg font-semibold">
                Ask about your calendar
              </h2>
              <p className="mt-1 text-sm text-black/50 dark:text-white/50">
                Read-only access to your Google Calendar.
              </p>
              <div className="mx-auto mt-6 grid max-w-md grid-cols-1 gap-2 sm:grid-cols-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => submit(s)}
                    className="rounded-lg border border-black/10 px-3 py-2 text-left text-sm hover:bg-black/[0.04] dark:border-white/15 dark:hover:bg-white/[0.05]"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m) => (
            <MessageView key={m.id} message={m} />
          ))}

          {status === "submitted" && (
            <div className="text-sm text-black/40 dark:text-white/40">
              Thinking…
            </div>
          )}

          {error && (
            <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
              {error.message || "Something went wrong."}
            </div>
          )}
        </div>
      </div>

      <div className="border-t border-black/10 p-3 dark:border-white/15">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void submit(input);
          }}
          className="mx-auto flex w-full max-w-2xl items-end gap-2"
        >
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void submit(input);
              }
            }}
            rows={1}
            placeholder="Ask about your calendar…"
            className="max-h-40 flex-1 resize-none rounded-xl border border-black/15 bg-transparent px-3 py-2 text-sm outline-none focus:border-black/40 dark:border-white/20 dark:focus:border-white/50"
          />
          {busy ? (
            <button
              type="button"
              onClick={() => stop()}
              className="rounded-xl border border-black/15 px-4 py-2 text-sm dark:border-white/20"
            >
              Stop
            </button>
          ) : (
            <button
              type="submit"
              disabled={!input.trim()}
              className="rounded-xl bg-foreground px-4 py-2 text-sm font-medium text-background disabled:opacity-40"
            >
              Send
            </button>
          )}
        </form>
      </div>
    </div>
  );
}
