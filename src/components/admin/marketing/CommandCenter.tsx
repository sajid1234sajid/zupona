"use client";

/** The box the operator types into, and the plan that unfolds underneath it.
 *
 * The stepping loop lives here rather than on the server. Each call to
 * `advancePlanAction` runs exactly one task and returns the whole plan's
 * state, so what the operator watches is the database's actual progress
 * rather than an animation that would keep moving if the work had stopped.
 *
 * It stops on the first failure. Every step reads the one before it, so
 * carrying on past a failure would build a plan around a hole and then present
 * it as finished. */

import { useActionState, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CircleCheck, CircleX, Loader, Send, TriangleAlert } from "lucide-react";
import { advancePlanAction, startPlanAction, type CommandState } from "@/app/admin/(panel)/marketing/ai/actions";
import type { RunView } from "@/lib/marketing/runs";
import { buttonStyles, textareaStyles } from "@/components/admin/ui";

const EXAMPLES = [
  "Promote the Classic White Sneaker for 7 days with ৳2,000",
  "Run a 5 day Facebook campaign for my best selling product with ৳1,500",
  "Create a launch campaign for the Z-Smart Watch with a ৳3,000 budget",
];

function TaskIcon({ status }: { status: string }) {
  if (status === "completed") return <CircleCheck className="h-4 w-4 shrink-0 text-brand" />;
  if (status === "failed") return <CircleX className="h-4 w-4 shrink-0 text-red-500" />;
  if (status === "running")
    return <Loader className="h-4 w-4 shrink-0 animate-spin text-neutral-400" />;
  return <span className="h-4 w-4 shrink-0 rounded-full border border-neutral-200" />;
}

export default function CommandCenter({ demoMode }: { demoMode: boolean }) {
  const router = useRouter();
  const [state, formAction, submitting] = useActionState<CommandState, FormData>(
    startPlanAction,
    {}
  );

  const [run, setRun] = useState<RunView | null>(null);
  const [stepError, setStepError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);

  // Which run the loop below is already driving. Without this a re-render
  // would start a second loop against the same plan, and the two would race
  // each other through the same queue.
  const driving = useRef<string | null>(null);

  useEffect(() => {
    const runId = state.runId;
    if (!runId || state.blocked || driving.current === runId) return;

    driving.current = runId;
    setRun(null);
    setStepError(null);
    setWorking(true);

    let cancelled = false;

    (async () => {
      // Bounded rather than `while (true)`: a plan has six steps, and a loop
      // that could run forever is one bug away from doing so.
      for (let step = 0; step < 12 && !cancelled; step++) {
        let result;
        try {
          result = await advancePlanAction(runId);
        } catch {
          if (!cancelled) setStepError("That step could not be reached. Try again.");
          break;
        }

        if (cancelled) return;
        if (result.run) setRun(result.run);
        if (result.error) {
          setStepError(result.error);
          break;
        }
        if (result.done) break;
      }

      if (!cancelled) {
        setWorking(false);
        router.refresh();
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [state.runId, state.blocked, router]);

  const finished = run?.tasks.length ? run.tasks.every((t) => t.status === "completed") : false;

  return (
    <div className="space-y-4">
      <form action={formAction} className="space-y-3">
        {/* The card above this already asks the question, so the box carries
            its label for screen readers rather than printing it twice. */}
        <textarea
          name="instruction"
          rows={3}
          required
          maxLength={1000}
          aria-label="What do you want to achieve?"
          placeholder="Promote the Classic White Sneaker for 7 days with ৳2,000"
          className={textareaStyles}
        />

        <div className="flex flex-wrap items-center gap-2">
          <button type="submit" disabled={submitting || working} className={buttonStyles.primary}>
            {submitting || working ? (
              <Loader className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            {submitting || working ? "Working…" : "Create plan"}
          </button>
          <span className="text-[11px] text-neutral-400">
            Nothing is published and no money is spent until you approve it.
          </span>
        </div>
      </form>

      {!state.runId && !working ? (
        <div className="rounded-xl border border-neutral-100 bg-neutral-50/60 p-3">
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-neutral-400">
            Try
          </p>
          <ul className="space-y-1">
            {EXAMPLES.map((example) => (
              <li key={example} className="text-[12px] text-neutral-500">
                “{example}”
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {state.error ? (
        <p className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3.5 py-3 text-[13px] text-red-700">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
          {state.error}
        </p>
      ) : null}

      {state.understanding ? (
        <div className="rounded-xl border border-brand/30 bg-brand-tint/40 px-3.5 py-3">
          <p className="text-[13px] text-neutral-700">{state.understanding}</p>

          {state.missing?.length ? (
            <ul className="mt-2 space-y-1 border-t border-brand/20 pt-2">
              {state.missing.map((question) => (
                <li key={question} className="text-[12px] font-medium text-neutral-600">
                  • {question}
                </li>
              ))}
            </ul>
          ) : null}

          {state.blocked ? (
            <p className="mt-2 text-[11px] text-neutral-500">
              Answer that in the box above and send it again — no plan was started.
            </p>
          ) : null}
        </div>
      ) : null}

      {run ? (
        <div className="rounded-xl border border-neutral-100 p-3.5">
          <div className="mb-2.5 flex items-center justify-between gap-2">
            <p className="text-[13px] font-semibold text-neutral-800">Plan</p>
            {run.isDemo || demoMode ? (
              <span className="rounded-md bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-700">
                Demo data
              </span>
            ) : null}
          </div>

          <ul className="space-y-1.5">
            {run.tasks.map((task) => (
              <li key={task.id} className="flex items-start gap-2.5">
                <span className="mt-0.5">
                  <TaskIcon status={task.status} />
                </span>
                <span className="min-w-0 flex-1">
                  <span
                    className={`block text-[12.5px] ${
                      task.status === "completed"
                        ? "text-neutral-700"
                        : task.status === "failed"
                          ? "text-red-600"
                          : "text-neutral-400"
                    }`}
                  >
                    {task.title}
                  </span>
                  {task.error ? (
                    <span className="block text-[11px] text-red-500">{task.error}</span>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>

          {stepError ? (
            <p className="mt-3 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-red-700">
              <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              {stepError}
            </p>
          ) : null}

          {finished && run.campaignId ? (
            <Link
              href={`/admin/marketing/campaigns/${run.campaignId}`}
              className={`${buttonStyles.primary} mt-3.5 w-full justify-center`}
            >
              Review the campaign
            </Link>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
