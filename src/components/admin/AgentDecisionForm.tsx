"use client";

import { useActionState } from "react";
import { Check, Eye, Loader2, MessageSquare, X } from "lucide-react";
import { FormMessage, buttonStyles, fieldStyles } from "./ui";
import { decideAgentAction, type AgentDecisionState } from "@/app/admin/(panel)/ai-agent/actions";

/** The four decisions on one AI-agent recommendation, the same ones the
 * WhatsApp buttons offer. The optional reason matters: the agent learns from
 * it, so a rejection with a reason is not proposed again. */
export default function AgentDecisionForm({ id, approved }: { id: number; approved: boolean }) {
  const [state, formAction, pending] = useActionState<AgentDecisionState, FormData>(decideAgentAction, {});

  return (
    <form action={formAction} className="space-y-2.5">
      <input type="hidden" name="id" value={id} />
      <input
        name="note"
        maxLength={1000}
        placeholder="Reason or note for the agent (optional)"
        className={`${fieldStyles} h-10`}
      />
      <div className="flex flex-wrap gap-2">
        {approved ? null : (
          <button type="submit" name="action" value="approve" disabled={pending} className={buttonStyles.primary}>
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            Approve
          </button>
        )}
        <button type="submit" name="action" value="reject" disabled={pending} className={buttonStyles.danger}>
          <X className="h-4 w-4" />
          Reject
        </button>
        <button type="submit" name="action" value="discuss" disabled={pending} className={buttonStyles.secondary}>
          <MessageSquare className="h-4 w-4" />
          Discuss
        </button>
        <button type="submit" name="action" value="watch" disabled={pending} className={buttonStyles.secondary}>
          <Eye className="h-4 w-4" />
          Watch
        </button>
      </div>
      <FormMessage error={state.error} success={state.success} />
    </form>
  );
}
