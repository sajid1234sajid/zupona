"use client";

import { useActionState, useState } from "react";
import { Loader2, MessageSquareReply } from "lucide-react";
import { replyToReviewAction, type ReplyState } from "@/app/seller/(panel)/reviews/actions";
import { buttonStyles, textareaStyles } from "@/components/admin/ui";

/** The reply box under a review. Collapsed to a single button until it is
 * wanted, so a page of twenty reviews is not twenty open text areas. */
export default function ReviewReplyForm({
  reviewId,
  reply,
}: {
  reviewId: string;
  reply: string | null;
}) {
  const [state, formAction, pending] = useActionState<ReplyState, FormData>(replyToReviewAction, {});
  const [open, setOpen] = useState(false);

  // Closes the box once a save has gone through, and only then -- a refused
  // save keeps what was typed on screen beside the reason. Adjusted during
  // render rather than in an effect, so the box never paints open-then-shut.
  const [seen, setSeen] = useState(state);
  if (seen !== state) {
    setSeen(state);
    if (state.success) setOpen(false);
  }

  if (!open) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => setOpen(true)} className={buttonStyles.ghost}>
          <MessageSquareReply className="h-3.5 w-3.5" />
          {reply ? "Edit reply" : "Reply"}
        </button>
        {state.success ? <span className="text-[12px] text-emerald-600">{state.success}</span> : null}
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-2">
      <input type="hidden" name="reviewId" value={reviewId} />
      <textarea
        name="reply"
        rows={3}
        maxLength={1000}
        defaultValue={reply ?? ""}
        placeholder="Thank the customer, or explain what you'll do about their problem. Everyone can read this."
        className={textareaStyles}
        autoFocus
      />
      {state.error ? <p className="text-[12px] text-red-600">{state.error}</p> : null}
      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={pending} className={buttonStyles.primary}>
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Publish reply
        </button>
        <button type="button" onClick={() => setOpen(false)} className={buttonStyles.ghost}>
          Cancel
        </button>
      </div>
    </form>
  );
}
