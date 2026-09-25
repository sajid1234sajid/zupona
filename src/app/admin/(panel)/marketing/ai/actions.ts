"use server";

/** The Marketing Command Center's writes.
 *
 * Every one of these opens with `requireAdmin()`. The layout above them
 * already redirects a shopper who reaches these URLs, but a layout guards
 * rendering and an action can be invoked directly -- and these actions read
 * the catalogue, spend model credit and decide what may be published.
 *
 * `support` staff are deliberately not admitted. They can answer tickets and
 * read orders; committing the shop's advertising budget is the owner's job. */

import { revalidatePath } from "next/cache";
import { getDB } from "@/lib/db";
import { AuthorizationError, logAdminAction, requireAdmin } from "@/lib/admin";
import { advanceRun, getRunView, startRun, type RunView } from "@/lib/marketing/runs";
import { ProviderFailed, ProviderNotConfigured } from "@/lib/ai/provider";

export interface CommandState {
  error?: string;
  runId?: string;
  understanding?: string;
  missing?: string[];
  blocked?: boolean;
}

function toState(error: unknown): CommandState {
  if (error instanceof AuthorizationError) return { error: error.message };
  if (error instanceof ProviderNotConfigured) return { error: error.message };
  if (error instanceof ProviderFailed) return { error: error.message };
  throw error;
}

/** The longest instruction worth accepting.
 *
 * Not a display limit -- a cost one. Everything typed here is paid for by the
 * token, and an operator who pastes a document into the box should be told so
 * rather than quietly billed for it. */
const MAX_INSTRUCTION = 1000;

/**
 * Reads what the operator typed and lays out a plan for it.
 *
 * Returns rather than throws, so the box can say "which product did you
 * mean?" instead of the page disappearing.
 */
export async function startPlanAction(
  _prev: CommandState,
  formData: FormData
): Promise<CommandState> {
  try {
    const admin = await requireAdmin();

    const instruction = String(formData.get("instruction") ?? "").trim();
    if (!instruction) {
      return { error: "Tell me what you want to achieve." };
    }
    if (instruction.length > MAX_INSTRUCTION) {
      return { error: `Keep the instruction under ${MAX_INSTRUCTION} characters.` };
    }

    const result = await startRun(instruction, admin.id);

    revalidatePath("/admin/marketing/ai");
    return {
      runId: result.runId,
      understanding: result.understanding,
      missing: result.missing,
      blocked: result.blocked,
    };
  } catch (error) {
    return toState(error);
  }
}

export interface StepState {
  done: boolean;
  error: string | null;
  run: RunView | null;
}

/**
 * Runs one step of a plan.
 *
 * Called repeatedly by the browser rather than looped on the server: each
 * step is its own request, so a plan that takes two minutes never depends on
 * one connection staying open for two minutes.
 */
export async function advancePlanAction(runId: string): Promise<StepState> {
  try {
    const admin = await requireAdmin();

    const step = await advanceRun(runId, admin.id);
    const run = await getRunView(runId);

    if (step.done) revalidatePath("/admin/marketing/ai");
    return { done: step.done, error: step.error, run };
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return { done: true, error: error.message, run: null };
    }
    throw error;
  }
}

/* -------------------------------------------------------------------------- */
/* Approval                                                                   */
/* -------------------------------------------------------------------------- */

export interface ApprovalState {
  error?: string;
  success?: string;
}

/**
 * Records a human decision about a campaign.
 *
 * The budget on screen is sent back with the decision and compared against
 * what the campaign actually holds. That is not ceremony: an approval is
 * permission to spend a particular amount, and if the plan changed between
 * the operator reading it and pressing the button, the permission they gave
 * was for a different plan.
 */
export async function decideCampaignAction(
  _prev: ApprovalState,
  formData: FormData
): Promise<ApprovalState> {
  try {
    const admin = await requireAdmin();
    const db = await getDB();

    const campaignId = String(formData.get("campaignId") ?? "");
    const decision = String(formData.get("decision") ?? "");
    const shownBudget = Number(formData.get("shownBudget") ?? -1);

    if (decision !== "approved" && decision !== "rejected") {
      return { error: "That is not a decision I understand." };
    }

    const campaign = await db
      .prepare(
        `SELECT id, name, status, budget_total, is_demo FROM marketing_campaigns WHERE id = ?`
      )
      .bind(campaignId)
      .first<{
        id: string;
        name: string;
        status: string;
        budget_total: number;
        is_demo: number;
      }>();

    if (!campaign) return { error: "That campaign no longer exists." };

    if (campaign.status !== "awaiting_approval" && campaign.status !== "draft") {
      return { error: `This campaign is already ${campaign.status.replace(/_/g, " ")}.` };
    }

    if (decision === "approved" && campaign.budget_total !== shownBudget) {
      return {
        error:
          "The budget changed since this screen was loaded, so the approval was not recorded. " +
          "Reload and check the figure before approving.",
      };
    }

    const creativeCount = await db
      .prepare("SELECT COUNT(*) AS n FROM marketing_creatives WHERE campaign_id = ?")
      .bind(campaignId)
      .first<{ n: number }>();

    await db.batch([
      db
        .prepare(
          `INSERT INTO marketing_approvals
             (id, campaign_id, decision, budget_snapshot, creative_count, note, decided_by)
           VALUES (?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          crypto.randomUUID(),
          campaignId,
          decision,
          campaign.budget_total,
          creativeCount?.n ?? 0,
          String(formData.get("note") ?? "").slice(0, 400) || null,
          admin.id
        ),
      db
        .prepare(
          `UPDATE marketing_campaigns SET status = ?, updated_at = datetime('now')
           WHERE id = ?`
        )
        .bind(decision === "approved" ? "approved" : "rejected", campaignId),
    ]);

    await logAdminAction(admin.id, `marketing.campaign.${decision}`, "marketing_campaign", campaignId, {
      after: { name: campaign.name, budget: campaign.budget_total, demo: campaign.is_demo === 1 },
    });

    revalidatePath("/admin/marketing/ai");
    revalidatePath(`/admin/marketing/campaigns/${campaignId}`);

    return {
      success:
        decision === "approved"
          ? "Approved. Nothing has been published yet — publishing is a separate step."
          : "Rejected. Nothing was spent.",
    };
  } catch (error) {
    if (error instanceof AuthorizationError) return { error: error.message };
    throw error;
  }
}
