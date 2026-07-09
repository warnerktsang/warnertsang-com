"use client";
import { useState } from "react";
import type { UIMessage } from "ai";

function humanToolName(partType: string): string {
  // "tool-google_calendar__read_events" -> "google_calendar.read_events"
  return partType.replace(/^tool-/, "").replace(/__/g, ".");
}

function ToolPart({
  name,
  state,
  input,
  output,
}: {
  name: string;
  state: string;
  input: unknown;
  output: unknown;
}) {
  const [open, setOpen] = useState(false);
  const running = state === "input-streaming" || state === "input-available";
  const failed = state === "output-error";

  return (
    <div className="my-1 rounded-lg border border-black/10 bg-black/[0.03] text-xs dark:border-white/15 dark:bg-white/[0.04]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 px-3 py-1.5 text-left"
      >
        <span
          className={
            failed
              ? "text-red-600 dark:text-red-400"
              : running
                ? "text-amber-600 dark:text-amber-400"
                : "text-emerald-600 dark:text-emerald-400"
          }
        >
          {failed ? "✕" : running ? "…" : "✓"}
        </span>
        <span className="font-mono">{name}</span>
        <span className="ml-auto text-black/40 dark:text-white/40">
          {open ? "hide" : "details"}
        </span>
      </button>
      {open && (
        <div className="space-y-2 border-t border-black/10 px-3 py-2 dark:border-white/10">
          <div>
            <div className="text-black/40 dark:text-white/40">input</div>
            <pre className="overflow-x-auto whitespace-pre-wrap">
              {JSON.stringify(input, null, 2)}
            </pre>
          </div>
          {output != null && (
            <div>
              <div className="text-black/40 dark:text-white/40">output</div>
              <pre className="overflow-x-auto whitespace-pre-wrap">
                {JSON.stringify(output, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function MessageView({ message }: { message: UIMessage }) {
  const isUser = message.role === "user";
  return (
    <div className={isUser ? "flex justify-end" : "flex justify-start"}>
      <div
        className={
          isUser
            ? "max-w-[80%] rounded-2xl bg-foreground px-4 py-2 text-sm text-background"
            : "max-w-[80%] rounded-2xl bg-black/[0.04] px-4 py-2 text-sm dark:bg-white/[0.06]"
        }
      >
        {message.parts.map((part, i) => {
          if (part.type === "text") {
            return (
              <p key={i} className="whitespace-pre-wrap leading-relaxed">
                {part.text}
              </p>
            );
          }
          if (part.type.startsWith("tool-")) {
            const p = part as unknown as {
              state: string;
              input: unknown;
              output: unknown;
            };
            return (
              <ToolPart
                key={i}
                name={humanToolName(part.type)}
                state={p.state}
                input={p.input}
                output={p.output}
              />
            );
          }
          return null;
        })}
      </div>
    </div>
  );
}
