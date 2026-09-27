"use server";

import { revalidatePath } from "next/cache";
import { AuthorizationError, logAdminAction, requireAdmin } from "@/lib/admin";
import { AgentUnavailableError, decideAgentRecommendation, type AgentAction } from "@/lib/aiAgent";

export interface AgentDecisionState {
  error?: string;
  success?: string;
}

const ACTIONS: AgentAction[] = ["approve", "reject", "discuss", "watch"];

const DONE: Record<AgentAction, string> = {
  approve: "Approved. The developer agent will open a pull request for you to review.",
  reject: "Rejected. The agent will remember this and not propose it again.",
  discuss: "Marked for discussion. Nothing will be built until you approve it.",
  watch: "Watching. The agent keeps an eye on it without acting.",
};

/** Approve, reject, discuss or watch one of the AI agent's recommendations.
 *
 * Admins only: the layout lets support staff into the panel, and an action can
 * be invoked without the page, so the check lives here too. */
export async function decideAgentAction(
  _prevState: AgentDecisionState,
  formData: FormData
): Promise<AgentDecisionState> {
  try {
    const admin = await requireAdmin();

    const id = Number.parseInt(String(formData.get("id") ?? ""), 10);
    const action = String(formData.get("action") ?? "") as AgentAction;
    const note = String(formData.get("note") ?? "").trim().slice(0, 1000);
    if (!Number.isInteger(id) || id <= 0 || !ACTIONS.includes(action)) {
      return { error: "That decision could not be read. Reload the page and try again." };
    }

    const result = await decideAgentRecommendation(id, action, note || null);
    if (!result.ok) return { error: result.message };

    await logAdminAction(admin.id, `ai_agent.${action}`, "ai_agent_recommendation", String(id), {
      after: { status: result.status, note: note || null, fixQueued: result.fixQueued },
    });
    revalidatePath("/admin/ai-agent");
    return { success: note ? `${DONE[action]} Your note was saved.` : DONE[action] };
  } catch (error) {
    if (error instanceof AuthorizationError) return { error: error.message };
    if (error instanceof AgentUnavailableError) return { error: error.message };
    throw error;
  }
}
