"use server";

import { recordFaqVote } from "@/lib/supportFeedback";

/** "Was this helpful?" on a help-centre answer. Never fails loudly: a vote
 * that did not save is not worth an error on the shopper's screen. */
export async function voteFaqAction(question: string, helpful: boolean): Promise<void> {
  try {
    await recordFaqVote(String(question ?? ""), Boolean(helpful));
  } catch (error) {
    console.error("faq vote failed", error);
  }
}
