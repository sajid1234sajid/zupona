/** Reading campaigns back out: one plan, the list, and the headline figures.
 *
 * Demo rows are filtered out of everything that reports a number and left in
 * everything that shows a plan. That split is the whole point of the flag: a
 * shop trying the system out should see its demo campaign sitting in the list
 * where it made it, and should never see demo spend inside its ROAS. */

import { getDB } from "@/lib/db";

export interface CampaignCreative {
  id: string;
  label: string;
  angle: string;
  hook: string;
  headline: string | null;
  body: string | null;
  script: string | null;
  visualDirection: string | null;
  cta: string | null;
  format: string;
  status: string;
  utmContent: string | null;
}

export interface CampaignView {
  id: string;
  name: string;
  objective: string;
  status: string;
  platform: string;
  budgetTotal: number;
  budgetDaily: number | null;
  startsAt: string | null;
  endsAt: string | null;
  utmCampaign: string | null;
  isDemo: boolean;
  externalId: string | null;
  externalError: string | null;
  productId: string | null;
  productName: string | null;
  audienceHypothesis: string | null;
  creatives: CampaignCreative[];
  decision: { decision: string; decidedAt: string; budgetSnapshot: number } | null;
}

export async function getCampaignView(campaignId: string): Promise<CampaignView | null> {
  const db = await getDB();

  const [campaignResult, creativeResult, approvalResult] = await db.batch<Record<string, unknown>>([
    db
      .prepare(
        `SELECT c.id, c.name, c.objective, c.status, c.platform, c.budget_total,
                c.budget_daily, c.starts_at, c.ends_at, c.utm_campaign, c.is_demo,
                c.external_id, c.external_error, c.audience_json,
                c.product_id, p.name AS product_name
         FROM marketing_campaigns c
         LEFT JOIN products p ON p.id = c.product_id
         WHERE c.id = ?`
      )
      .bind(campaignId),
    db
      .prepare(
        `SELECT id, label, angle, hook, headline, body, script, visual_direction,
                cta, format, status, utm_content
         FROM marketing_creatives WHERE campaign_id = ? ORDER BY label ASC`
      )
      .bind(campaignId),
    db
      .prepare(
        `SELECT decision, decided_at, budget_snapshot FROM marketing_approvals
         WHERE campaign_id = ? ORDER BY decided_at DESC LIMIT 1`
      )
      .bind(campaignId),
  ]);

  const row = (
    campaignResult.results as unknown as {
      id: string;
      name: string;
      objective: string;
      status: string;
      platform: string;
      budget_total: number;
      budget_daily: number | null;
      starts_at: string | null;
      ends_at: string | null;
      utm_campaign: string | null;
      is_demo: number;
      external_id: string | null;
      external_error: string | null;
      audience_json: string | null;
      product_id: string | null;
      product_name: string | null;
    }[]
  )[0];

  if (!row) return null;

  let hypothesis: string | null = null;
  try {
    hypothesis = row.audience_json
      ? ((JSON.parse(row.audience_json) as { hypothesis?: string }).hypothesis ?? null)
      : null;
  } catch {
    // A malformed blob is not worth failing a page over.
    hypothesis = null;
  }

  const approval = (
    approvalResult.results as unknown as {
      decision: string;
      decided_at: string;
      budget_snapshot: number;
    }[]
  )[0];

  return {
    id: row.id,
    name: row.name,
    objective: row.objective,
    status: row.status,
    platform: row.platform,
    budgetTotal: row.budget_total,
    budgetDaily: row.budget_daily,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    utmCampaign: row.utm_campaign,
    isDemo: row.is_demo === 1,
    externalId: row.external_id,
    externalError: row.external_error,
    productId: row.product_id,
    productName: row.product_name,
    audienceHypothesis: hypothesis,
    creatives: (
      creativeResult.results as unknown as {
        id: string;
        label: string;
        angle: string;
        hook: string;
        headline: string | null;
        body: string | null;
        script: string | null;
        visual_direction: string | null;
        cta: string | null;
        format: string;
        status: string;
        utm_content: string | null;
      }[]
    ).map((creative) => ({
      id: creative.id,
      label: creative.label,
      angle: creative.angle,
      hook: creative.hook,
      headline: creative.headline,
      body: creative.body,
      script: creative.script,
      visualDirection: creative.visual_direction,
      cta: creative.cta,
      format: creative.format,
      status: creative.status,
      utmContent: creative.utm_content,
    })),
    decision: approval
      ? {
          decision: approval.decision,
          decidedAt: approval.decided_at,
          budgetSnapshot: approval.budget_snapshot,
        }
      : null,
  };
}

/* -------------------------------------------------------------------------- */
/* Lists and headline figures                                                 */
/* -------------------------------------------------------------------------- */

export interface CampaignRow {
  id: string;
  name: string;
  status: string;
  budgetTotal: number;
  productName: string | null;
  creativeCount: number;
  isDemo: boolean;
  createdAt: string;
}

export async function listCampaigns(limit = 20): Promise<CampaignRow[]> {
  const db = await getDB();
  const { results } = await db
    .prepare(
      `SELECT c.id, c.name, c.status, c.budget_total, c.is_demo, c.created_at,
              p.name AS product_name,
              (SELECT COUNT(*) FROM marketing_creatives WHERE campaign_id = c.id) AS creatives
       FROM marketing_campaigns c
       LEFT JOIN products p ON p.id = c.product_id
       ORDER BY c.created_at DESC LIMIT ?`
    )
    .bind(limit)
    .all<{
      id: string;
      name: string;
      status: string;
      budget_total: number;
      is_demo: number;
      created_at: string;
      product_name: string | null;
      creatives: number;
    }>();

  return results.map((row) => ({
    id: row.id,
    name: row.name,
    status: row.status,
    budgetTotal: row.budget_total,
    productName: row.product_name,
    creativeCount: row.creatives,
    isDemo: row.is_demo === 1,
    createdAt: row.created_at,
  }));
}

export interface MarketingOverview {
  spendToday: number;
  revenueToday: number;
  ordersToday: number;
  /** Null rather than zero when nothing has been spent: a cost per order of
   * ৳0 reads as "free", and free is not what "no data" means. */
  cpa: number | null;
  roas: number | null;
  activeCampaigns: number;
  pendingApprovals: number;
  awaiting: { id: string; name: string; budgetTotal: number; creativeCount: number }[];
  recentRuns: { id: string; summary: string; status: string; createdAt: string; isDemo: boolean }[];
}

/** The dashboard's numbers, in one batched trip.
 *
 * Every figure that describes money excludes demo rows. `orders` comes from
 * the shop's own table rather than from the advertising platform, because
 * that is the number the shop was actually paid. */
export async function getMarketingOverview(): Promise<MarketingOverview> {
  const db = await getDB();

  const [metrics, orders, campaigns, awaiting, runs] = await db.batch<Record<string, unknown>>([
    db.prepare(
      `SELECT COALESCE(SUM(spend), 0) AS spend, COALESCE(SUM(revenue), 0) AS revenue,
              COALESCE(SUM(purchases), 0) AS purchases
       FROM marketing_metrics
       WHERE is_demo = 0 AND stat_date = DATE('now')`
    ),
    db.prepare(
      `SELECT COUNT(*) AS n, COALESCE(SUM(total), 0) AS revenue
       FROM orders
       WHERE status != 'cancelled' AND DATE(placed_at) = DATE('now')`
    ),
    db.prepare(
      `SELECT
         SUM(CASE WHEN status = 'live' THEN 1 ELSE 0 END) AS live,
         SUM(CASE WHEN status = 'awaiting_approval' THEN 1 ELSE 0 END) AS awaiting
       FROM marketing_campaigns`
    ),
    db.prepare(
      `SELECT c.id, c.name, c.budget_total,
              (SELECT COUNT(*) FROM marketing_creatives WHERE campaign_id = c.id) AS creatives
       FROM marketing_campaigns c
       WHERE c.status = 'awaiting_approval'
       ORDER BY c.created_at DESC LIMIT 5`
    ),
    db.prepare(
      `SELECT id, input_summary, status, created_at, is_demo
       FROM marketing_runs ORDER BY created_at DESC LIMIT 8`
    ),
  ]);

  const metricRow = (
    metrics.results as unknown as { spend: number; revenue: number; purchases: number }[]
  )[0];
  const orderRow = (orders.results as unknown as { n: number; revenue: number }[])[0];
  const campaignRow = (
    campaigns.results as unknown as { live: number | null; awaiting: number | null }[]
  )[0];

  const spend = metricRow?.spend ?? 0;
  const attributedRevenue = metricRow?.revenue ?? 0;
  const purchases = metricRow?.purchases ?? 0;

  return {
    spendToday: spend,
    revenueToday: attributedRevenue,
    ordersToday: orderRow?.n ?? 0,
    cpa: spend > 0 && purchases > 0 ? Math.round(spend / purchases) : null,
    roas: spend > 0 ? Math.round((attributedRevenue / spend) * 100) / 100 : null,
    activeCampaigns: campaignRow?.live ?? 0,
    pendingApprovals: campaignRow?.awaiting ?? 0,
    awaiting: (
      awaiting.results as unknown as {
        id: string;
        name: string;
        budget_total: number;
        creatives: number;
      }[]
    ).map((row) => ({
      id: row.id,
      name: row.name,
      budgetTotal: row.budget_total,
      creativeCount: row.creatives,
    })),
    recentRuns: (
      runs.results as unknown as {
        id: string;
        input_summary: string;
        status: string;
        created_at: string;
        is_demo: number;
      }[]
    ).map((row) => ({
      id: row.id,
      summary: row.input_summary,
      status: row.status,
      createdAt: row.created_at,
      isDemo: row.is_demo === 1,
    })),
  };
}
