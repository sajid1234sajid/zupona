/** Driving a plan forward, one step per request.
 *
 * A whole plan is four model calls and can take a couple of minutes. Doing
 * that inside a single server action is how you get a request that dies
 * halfway and leaves the operator staring at a spinner with no idea whether
 * their budget was committed. So the plan is a list of rows, and each request
 * advances exactly one of them.
 *
 * What that buys, beyond not timing out: the progress the operator watches is
 * real rather than animated, a refreshed tab resumes instead of restarting,
 * and a step that fails fails alone -- the research survives a creative writer
 * that returned nothing, and Retry costs one call rather than four.
 *
 * Nothing here spends money. The last task a plan runs is `request_approval`,
 * and it stops there by construction: publishing lives behind a separate
 * action that checks a human's recorded decision first. */

import { getDB } from "@/lib/db";
import { logAdminAction } from "@/lib/admin";
import {
  getAudienceShape,
  getProductBrief,
  listMarketableProducts,
  listPriorLessons,
  type ProductBrief,
} from "./data";
import { creatives, parseCommand, research, strategy } from "./agents";
import { getTextProvider, type TextProvider } from "@/lib/ai/provider";
import { clampBudget, clampDays } from "./safety";
import { demoPlan } from "./demo";

/** How many advert concepts a plan writes. The specification asks for at
 * least five, which is also about the point where a small budget stops being
 * able to test them all properly. */
const CREATIVE_COUNT = 5;

/** The steps every plan goes through, in order. Stored as rows when the run
 * starts so the operator can see the whole plan before any of it has run. */
const TASK_PLAN: { kind: string; title: string }[] = [
  { kind: "inspect_product", title: "Inspect the product and its stock" },
  { kind: "research", title: "Research angles and customer problems" },
  { kind: "strategy", title: "Decide positioning, offer and test plan" },
  { kind: "creatives", title: `Write ${CREATIVE_COUNT} advert concepts` },
  { kind: "draft_campaign", title: "Assemble the campaign draft" },
  { kind: "request_approval", title: "Send for your approval" },
];

export interface TaskRow {
  id: string;
  seq: number;
  kind: string;
  title: string;
  status: string;
  error: string | null;
}

export interface RunView {
  id: string;
  status: string;
  instruction: string;
  isDemo: boolean;
  error: string | null;
  tasks: TaskRow[];
  campaignId: string | null;
}

/* -------------------------------------------------------------------------- */
/* Starting a run                                                             */
/* -------------------------------------------------------------------------- */

/**
 * Reads the instruction, works out what it asked for, and lays out the plan.
 *
 * The parse happens here rather than as the first task because its answer
 * decides whether there is anything to plan at all -- an instruction naming no
 * product this shop sells should come straight back as a question, not as six
 * queued steps that are all going to fail.
 */
export async function startRun(
  instruction: string,
  adminId: string
): Promise<{ runId: string; understanding: string; missing: string[]; blocked: boolean }> {
  const db = await getDB();
  const provider = await getTextProvider();
  const runId = crypto.randomUUID();
  const isDemo = provider === null;

  const products = await listMarketableProducts();

  let parsed;
  let model: string | null = null;

  if (provider) {
    const result = await parseCommand(instruction, products, provider);
    parsed = result.value;
    model = result.model;
  } else {
    parsed = demoPlan.parseCommand(instruction, products);
  }

  // The operator's stated budget is the authority. Anything the model
  // proposed beyond it is corrected here, before it is ever shown as a plan.
  const budget = clampBudget(parsed.budget ?? 0, parsed.budget);
  const days = clampDays(parsed.days ?? 7, parsed.days);

  const missing = [...parsed.missing];
  if (!parsed.productId) {
    missing.unshift(parsed.productNote || "Which product should this promote?");
  }
  if (parsed.budget === null) {
    missing.push("What budget should this campaign use, in Taka?");
  }

  const blocked = !parsed.productId || parsed.budget === null;

  await db
    .prepare(
      `INSERT INTO marketing_runs
         (id, agent_type, status, model, input_summary, input_reference,
          output_json, is_demo, created_by)
       VALUES (?, 'command', ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      runId,
      blocked ? "completed" : "queued",
      model,
      instruction.slice(0, 500),
      parsed.productId,
      JSON.stringify({
        ...parsed,
        budget: budget.value,
        days: days.value,
        adjustments: [...budget.adjustments, ...days.adjustments],
      }),
      isDemo ? 1 : 0,
      adminId
    )
    .run();

  // A blocked run gets no tasks: there is nothing to do until the operator
  // answers, and queueing steps that cannot run would only look like progress.
  if (!blocked) {
    await db.batch(
      TASK_PLAN.map((task, index) =>
        db
          .prepare(
            `INSERT INTO marketing_tasks (id, run_id, seq, kind, title, status)
             VALUES (?, ?, ?, ?, ?, 'queued')`
          )
          .bind(crypto.randomUUID(), runId, index, task.kind, task.title)
      )
    );
  }

  await logAdminAction(adminId, "marketing.run.start", "marketing_run", runId, {
    after: { instruction: instruction.slice(0, 200), demo: isDemo },
  });

  return {
    runId,
    understanding: parsed.understanding,
    missing,
    blocked,
  };
}

/* -------------------------------------------------------------------------- */
/* Advancing it                                                               */
/* -------------------------------------------------------------------------- */

interface RunRecord {
  id: string;
  status: string;
  input_summary: string;
  input_reference: string | null;
  output_json: string | null;
  is_demo: number;
}

async function readRun(runId: string): Promise<RunRecord | null> {
  const db = await getDB();
  return db
    .prepare(
      `SELECT id, status, input_summary, input_reference, output_json, is_demo
       FROM marketing_runs WHERE id = ?`
    )
    .bind(runId)
    .first<RunRecord>();
}

async function readTaskOutput<T>(runId: string, kind: string): Promise<T | null> {
  const db = await getDB();
  const row = await db
    .prepare(
      `SELECT output_json FROM marketing_tasks
       WHERE run_id = ? AND kind = ? AND status = 'completed'`
    )
    .bind(runId, kind)
    .first<{ output_json: string | null }>();
  return row?.output_json ? (JSON.parse(row.output_json) as T) : null;
}

/**
 * Runs the next queued step of a plan and reports where it got to.
 *
 * Returns `done` when there is nothing left to run. A failed step stops the
 * run rather than carrying on: every later step reads the one before it, so
 * continuing past a failure would produce a plan built on a gap and present it
 * as though it were whole.
 */
export async function advanceRun(
  runId: string,
  adminId: string
): Promise<{ done: boolean; ranTask: string | null; error: string | null }> {
  const db = await getDB();
  const run = await readRun(runId);
  if (!run) return { done: true, ranTask: null, error: "That plan no longer exists." };

  const task = await db
    .prepare(
      `SELECT id, kind, title, seq FROM marketing_tasks
       WHERE run_id = ? AND status = 'queued' ORDER BY seq ASC LIMIT 1`
    )
    .bind(runId)
    .first<{ id: string; kind: string; title: string; seq: number }>();

  if (!task) {
    await db
      .prepare(
        `UPDATE marketing_runs SET status = 'completed',
         completed_at = datetime('now') WHERE id = ? AND status != 'failed'`
      )
      .bind(runId)
      .run();
    return { done: true, ranTask: null, error: null };
  }

  await db
    .prepare("UPDATE marketing_tasks SET status = 'running' WHERE id = ?")
    .bind(task.id)
    .run();
  await db
    .prepare("UPDATE marketing_runs SET status = 'running' WHERE id = ?")
    .bind(runId)
    .run();

  try {
    const output = await runTask(run, task.kind, adminId);

    await db
      .prepare(
        `UPDATE marketing_tasks SET status = 'completed', output_json = ?,
         completed_at = datetime('now') WHERE id = ?`
      )
      .bind(JSON.stringify(output ?? {}), task.id)
      .run();

    return { done: false, ranTask: task.kind, error: null };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "That step failed for an unknown reason.";

    await db.batch([
      db
        .prepare(
          `UPDATE marketing_tasks SET status = 'failed', error = ?,
           completed_at = datetime('now') WHERE id = ?`
        )
        .bind(message.slice(0, 400), task.id),
      db
        .prepare(
          `UPDATE marketing_runs SET status = 'failed', error = ?,
           completed_at = datetime('now') WHERE id = ?`
        )
        .bind(message.slice(0, 400), runId),
    ]);

    console.error("marketing task failed", { runId, kind: task.kind, error });
    return { done: true, ranTask: task.kind, error: message };
  }
}

/** One step's actual work. Each reads what the previous one stored. */
async function runTask(
  run: RunRecord,
  kind: string,
  adminId: string
): Promise<unknown> {
  const parsed = run.output_json ? JSON.parse(run.output_json) : {};
  const productId: string | null = run.input_reference;
  const isDemo = run.is_demo === 1;
  const provider: TextProvider | null = isDemo ? null : await getTextProvider();

  if (!isDemo && !provider) {
    throw new Error("The AI provider is no longer configured. Add a key in Settings.");
  }

  switch (kind) {
    case "inspect_product": {
      if (!productId) throw new Error("This plan has no product to inspect.");
      const product = await getProductBrief(productId);
      if (!product) throw new Error("That product no longer exists.");
      return product;
    }

    case "research": {
      const product = await readTaskOutput<ProductBrief>(run.id, "inspect_product");
      if (!product) throw new Error("The product inspection step has not run.");

      // The two reads the brief needs do not depend on each other.
      const [lessons, audience] = await Promise.all([
        listPriorLessons(product.id),
        getAudienceShape(),
      ]);

      if (!provider) return demoPlan.research(product);
      return (await research(product, lessons, audience, provider)).value;
    }

    case "strategy": {
      const [product, brief] = await Promise.all([
        readTaskOutput<ProductBrief>(run.id, "inspect_product"),
        readTaskOutput<Awaited<ReturnType<typeof demoPlan.research>>>(run.id, "research"),
      ]);
      if (!product || !brief) throw new Error("The research step has not run.");

      if (!provider) return demoPlan.strategy(product);
      return (await strategy(brief, product, parsed.budget ?? 0, parsed.days ?? 7, provider)).value;
    }

    case "creatives": {
      const [product, plan] = await Promise.all([
        readTaskOutput<ProductBrief>(run.id, "inspect_product"),
        readTaskOutput<Awaited<ReturnType<typeof demoPlan.strategy>>>(run.id, "strategy"),
      ]);
      if (!product || !plan) throw new Error("The strategy step has not run.");

      if (!provider) return { creatives: demoPlan.creatives(product) };
      return { creatives: (await creatives(plan, product, CREATIVE_COUNT, provider)).value };
    }

    case "draft_campaign":
      return draftCampaign(run, parsed, adminId);

    case "request_approval": {
      const db = await getDB();
      await db
        .prepare(
          `UPDATE marketing_campaigns SET status = 'awaiting_approval',
           updated_at = datetime('now') WHERE run_id = ? AND status = 'draft'`
        )
        .bind(run.id)
        .run();
      return { awaiting: true };
    }

    default:
      throw new Error(`Unknown step: ${kind}`);
  }
}

/* -------------------------------------------------------------------------- */
/* Turning the plan into a campaign draft                                     */
/* -------------------------------------------------------------------------- */

/** Builds the UTM parameters rather than letting anyone type them.
 *
 * Hand-typed tracking is how a week's spend becomes unattributable: one
 * capital letter or one stray space and the report has two campaigns where the
 * shop ran one. */
function utmSlug(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
}

async function draftCampaign(
  run: RunRecord,
  parsed: { budget?: number; days?: number; objective?: string; platform?: string },
  adminId: string
): Promise<unknown> {
  const db = await getDB();

  const [product, plan, creativeSet] = await Promise.all([
    readTaskOutput<ProductBrief>(run.id, "inspect_product"),
    readTaskOutput<{ campaignName: string; audienceHypothesis: string; primaryCta: string }>(
      run.id,
      "strategy"
    ),
    readTaskOutput<{ creatives: Record<string, string>[] }>(run.id, "creatives"),
  ]);

  if (!product || !plan) throw new Error("The plan is incomplete.");

  const campaignId = crypto.randomUUID();
  const budget = Math.max(0, Math.round(parsed.budget ?? 0));
  const days = Math.max(1, Math.round(parsed.days ?? 7));
  const utmCampaign = utmSlug(plan.campaignName || product.name);

  const starts = new Date();
  const ends = new Date(starts.getTime() + days * 24 * 60 * 60 * 1000);

  await db
    .prepare(
      `INSERT INTO marketing_campaigns
         (id, run_id, name, objective, product_id, status, platform,
          budget_total, budget_daily, starts_at, ends_at, audience_json,
          utm_campaign, is_demo, created_by)
       VALUES (?, ?, ?, ?, ?, 'draft', ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      campaignId,
      run.id,
      plan.campaignName || `${product.name} — Test 01`,
      parsed.objective ?? "purchase",
      product.id,
      parsed.platform ?? "meta",
      budget,
      days > 0 ? Math.floor(budget / days) : null,
      starts.toISOString().slice(0, 19).replace("T", " "),
      ends.toISOString().slice(0, 19).replace("T", " "),
      JSON.stringify({ hypothesis: plan.audienceHypothesis }),
      utmCampaign,
      run.is_demo,
      adminId
    )
    .run();

  const list = creativeSet?.creatives ?? [];
  if (list.length) {
    await db.batch(
      list.map((creative, index) =>
        db
          .prepare(
            `INSERT INTO marketing_creatives
               (id, campaign_id, run_id, product_id, label, angle, hook, headline,
                body, script, visual_direction, cta, format, status, utm_content, is_demo)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ready', ?, ?)`
          )
          .bind(
            crypto.randomUUID(),
            campaignId,
            run.id,
            product.id,
            creative.label ?? `Creative #${String(index + 1).padStart(2, "0")}`,
            creative.angle ?? "",
            creative.hook ?? "",
            creative.headline ?? null,
            creative.body ?? null,
            creative.script ?? null,
            creative.visualDirection ?? null,
            creative.cta ?? plan.primaryCta ?? null,
            creative.format ?? "image",
            `creative_${String(index + 1).padStart(2, "0")}`,
            run.is_demo
          )
      )
    );
  }

  return { campaignId, creativeCount: list.length };
}

/* -------------------------------------------------------------------------- */
/* Reading a run back                                                         */
/* -------------------------------------------------------------------------- */

export async function getRunView(runId: string): Promise<RunView | null> {
  const db = await getDB();

  const [runResult, taskResult, campaignResult] = await db.batch<Record<string, unknown>>([
    db
      .prepare(
        `SELECT id, status, input_summary, error, is_demo
         FROM marketing_runs WHERE id = ?`
      )
      .bind(runId),
    db
      .prepare(
        `SELECT id, seq, kind, title, status, error FROM marketing_tasks
         WHERE run_id = ? ORDER BY seq ASC`
      )
      .bind(runId),
    db.prepare("SELECT id FROM marketing_campaigns WHERE run_id = ? LIMIT 1").bind(runId),
  ]);

  const run = (
    runResult.results as unknown as {
      id: string;
      status: string;
      input_summary: string;
      error: string | null;
      is_demo: number;
    }[]
  )[0];

  if (!run) return null;

  return {
    id: run.id,
    status: run.status,
    instruction: run.input_summary,
    isDemo: run.is_demo === 1,
    error: run.error,
    tasks: (
      taskResult.results as unknown as {
        id: string;
        seq: number;
        kind: string;
        title: string;
        status: string;
        error: string | null;
      }[]
    ).map((row) => ({
      id: row.id,
      seq: row.seq,
      kind: row.kind,
      title: row.title,
      status: row.status,
      error: row.error,
    })),
    campaignId:
      (campaignResult.results as unknown as { id: string }[])[0]?.id ?? null,
  };
}
