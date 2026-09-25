"use server";

/** The assistant's one write: asking it something.
 *
 * `requireAdmin()` opens it, as everywhere else in the panel. Support staff
 * are deliberately excluded -- the readings behind this reach the shop's
 * takings, its margins and its advertising spend, which is the owner's
 * business rather than a ticket queue's. */

import { revalidatePath } from "next/cache";
import { AuthorizationError, logAdminAction, requireAdmin } from "@/lib/admin";
import { ask } from "@/lib/ai/assistant";
import { ProviderFailed, ProviderNotConfigured } from "@/lib/ai/provider";
import { addMessage, createThread, historyFor, listMessages, ownsThread } from "@/lib/ai/threads";
import type { ThreadMessage } from "@/lib/ai/threads";

export interface AskState {
  error?: string;
  threadId?: string;
  messages?: ThreadMessage[];
}

/** Long enough for a real question, short enough that a pasted document is
 * caught here rather than on the bill. */
const MAX_QUESTION = 2000;

export async function askAction(_prev: AskState, formData: FormData): Promise<AskState> {
  let threadId = String(formData.get("threadId") ?? "").trim() || null;

  try {
    const admin = await requireAdmin();

    const question = String(formData.get("question") ?? "").trim();
    if (!question) return { error: "Ask me something.", threadId: threadId ?? undefined };
    if (question.length > MAX_QUESTION) {
      return {
        error: `Keep the question under ${MAX_QUESTION} characters.`,
        threadId: threadId ?? undefined,
      };
    }

    // An id that arrived in a form is not proof of anything until it is
    // checked against who is asking.
    if (threadId && !(await ownsThread(threadId, admin.id))) {
      return { error: "That conversation is not yours.", threadId: undefined };
    }

    if (!threadId) threadId = await createThread(question, admin.id);

    const history = await historyFor(threadId);
    await addMessage(threadId, { role: "user", content: question });

    const answer = await ask(question, history);

    await addMessage(threadId, {
      role: "assistant",
      content: answer.answer,
      readingsUsed: answer.readingsUsed,
      proposals: answer.proposals,
      model: answer.model,
      inputTokens: answer.inputTokens,
      outputTokens: answer.outputTokens,
    });

    await logAdminAction(admin.id, "assistant.ask", "assistant_thread", threadId, {
      after: { question: question.slice(0, 200), readings: answer.readingsUsed },
    });

    revalidatePath("/admin/assistant");
    return { threadId, messages: await listMessages(threadId, admin.id) };
  } catch (error) {
    if (
      error instanceof AuthorizationError ||
      error instanceof ProviderNotConfigured ||
      error instanceof ProviderFailed
    ) {
      // The question is already stored, so the thread reads correctly even
      // when the answer never arrived.
      return { error: error.message, threadId: threadId ?? undefined };
    }
    throw error;
  }
}
