"use client";

/** The conversation itself.
 *
 * Optimistic only as far as the question: the owner's own words appear the
 * moment they press send, because those are already true. The answer is never
 * guessed at -- it appears when the server has one, and if the call fails the
 * question stays on screen with the reason underneath it rather than
 * vanishing as though it had never been asked. */

import { useActionState, useEffect, useRef, useState } from "react";
import { Bot, CircleHelp, Database, Loader, Send, TriangleAlert, User } from "lucide-react";
import { askAction, type AskState } from "@/app/admin/(panel)/assistant/actions";
import type { ThreadMessage } from "@/lib/ai/threads";
import { buttonStyles, textareaStyles } from "@/components/admin/ui";

const SUGGESTIONS = [
  "How did sales go this month?",
  "Which products are running out of stock?",
  "What are my best selling products right now?",
  "Why might orders have dropped this week?",
];

export default function AssistantChat({
  initialMessages,
  initialThreadId,
  demoMode,
}: {
  initialMessages: ThreadMessage[];
  initialThreadId: string | null;
  demoMode: boolean;
}) {
  const [state, formAction, pending] = useActionState<AskState, FormData>(askAction, {
    threadId: initialThreadId ?? undefined,
    messages: initialMessages,
  });

  const [pendingQuestion, setPendingQuestion] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const messages = state.messages ?? initialMessages;

  // The answer landed, so the question is in the thread and no longer pending.
  useEffect(() => {
    if (!pending) setPendingQuestion(null);
  }, [pending, messages.length]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, pending]);

  return (
    <div className="flex min-h-[26rem] flex-col">
      <div className="min-h-0 flex-1 space-y-4">
        {messages.length === 0 && !pendingQuestion ? (
          <div className="rounded-xl border border-neutral-100 bg-neutral-50/60 p-4">
            <p className="flex items-center gap-2 text-[13px] font-semibold text-neutral-700">
              <Bot className="h-4 w-4 text-brand" />
              Ask me about your shop
            </p>
            <p className="mt-1 text-[12px] text-neutral-500">
              I can read your orders, products, stock, customers and campaigns. I answer from
              your own figures, and I say so when I do not have them.
            </p>
            <ul className="mt-3 space-y-1.5">
              {SUGGESTIONS.map((suggestion) => (
                <li key={suggestion}>
                  <button
                    type="button"
                    onClick={() => {
                      const box = formRef.current?.elements.namedItem(
                        "question"
                      ) as HTMLTextAreaElement | null;
                      if (box) {
                        box.value = suggestion;
                        box.focus();
                      }
                    }}
                    className="text-left text-[12.5px] text-neutral-500 underline-offset-2 hover:text-brand hover:underline"
                  >
                    {suggestion}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {messages.map((message) =>
          message.role === "user" ? (
            <Question key={message.id} text={message.content} />
          ) : (
            <Answer key={message.id} message={message} />
          )
        )}

        {pendingQuestion ? <Question text={pendingQuestion} /> : null}

        {pending ? (
          <p className="flex items-center gap-2 text-[12.5px] text-neutral-400">
            <Loader className="h-4 w-4 animate-spin" />
            Reading your shop…
          </p>
        ) : null}

        {state.error ? (
          <p className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3.5 py-3 text-[13px] text-red-700">
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
            {state.error}
          </p>
        ) : null}

        <div ref={endRef} />
      </div>

      <form
        ref={formRef}
        action={formAction}
        onSubmit={(event) => {
          const box = (event.currentTarget.elements.namedItem("question") as HTMLTextAreaElement)
            ?.value;
          if (box?.trim()) setPendingQuestion(box.trim());
          // Cleared here rather than in an effect so the box is empty the
          // instant the question moves into the thread above it.
          requestAnimationFrame(() => formRef.current?.reset());
        }}
        className="mt-4 space-y-2.5 border-t border-neutral-100 pt-4"
      >
        <input type="hidden" name="threadId" value={state.threadId ?? ""} />
        <textarea
          name="question"
          rows={2}
          required
          maxLength={2000}
          aria-label="Ask the assistant"
          placeholder={
            demoMode ? "Add an API key in Settings to ask anything" : "How did sales go this month?"
          }
          disabled={demoMode}
          className={textareaStyles}
        />
        <div className="flex flex-wrap items-center gap-2">
          <button type="submit" disabled={pending || demoMode} className={buttonStyles.primary}>
            {pending ? <Loader className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {pending ? "Thinking…" : "Ask"}
          </button>
          <span className="text-[11px] text-neutral-400">
            It reads your shop. It changes nothing without your approval.
          </span>
        </div>
      </form>
    </div>
  );
}

function Question({ text }: { text: string }) {
  return (
    <div className="flex justify-end">
      <p className="flex max-w-[85%] items-start gap-2.5 rounded-2xl rounded-tr-sm bg-brand px-3.5 py-2.5 text-[13px] text-white">
        <span className="min-w-0 whitespace-pre-wrap">{text}</span>
        <User className="mt-0.5 h-4 w-4 shrink-0 opacity-70" />
      </p>
    </div>
  );
}

function Answer({ message }: { message: ThreadMessage }) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-brand-tint">
        <Bot className="h-4 w-4 text-brand" />
      </span>

      <div className="min-w-0 flex-1">
        <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-neutral-700">
          {message.content}
        </p>

        {message.readingsUsed.length ? (
          <p className="mt-2 flex flex-wrap items-center gap-1.5 text-[10.5px] text-neutral-400">
            <Database className="h-3 w-3" />
            {message.readingsUsed.map((reading) => (
              <span key={reading} className="rounded bg-neutral-100 px-1.5 py-0.5">
                {reading.replace(/_/g, " ")}
              </span>
            ))}
          </p>
        ) : null}

        {message.proposals.length ? (
          <ul className="mt-2.5 space-y-2">
            {message.proposals.map((proposal, index) => (
              <li
                key={`${message.id}-${index}`}
                className="rounded-xl border border-amber-200 bg-amber-50/60 px-3 py-2.5"
              >
                <p className="flex items-center gap-1.5 text-[12.5px] font-semibold text-neutral-800">
                  <CircleHelp className="h-3.5 w-3.5 text-amber-600" />
                  {proposal.summary}
                </p>
                <p className="mt-0.5 text-[12px] text-neutral-600">{proposal.detail}</p>
                <p className="mt-1.5 text-[10.5px] text-amber-700">
                  Suggested only — nothing has been changed.
                </p>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  );
}
