/** The agents themselves: understand, research, decide, write.
 *
 * Four small specialists rather than one large prompt, because they fail
 * differently and are worth debugging separately. The parser can be wrong
 * about which product was meant while the strategy is sound; the creative
 * writer can be weak while the research underneath it is good. Kept apart,
 * each shows up as its own row in `marketing_runs` with its own input and its
 * own output, which is what makes "why did it suggest that?" answerable.
 *
 * Every one of them returns a structure the API validated against a schema, so
 * nothing downstream parses prose. Every one of them reads shop content only
 * through `fence()`, so nothing a seller typed is ever read as an instruction.
 * And every one of them is told the same two rules -- what counts as data, and
 * what may never be invented. */

import {
  getTextProvider,
  type TextProvider,
  type TextResult,
  ProviderNotConfigured,
} from "@/lib/ai/provider";
import { fence, UNTRUSTED_CONTENT_RULE, HONESTY_RULE, text } from "./safety";
import type { AudienceShape, MarketableProduct, PriorLesson, ProductBrief } from "./data";

const HOUSE_STYLE = `You are the marketing strategist for Zupona, an online shop in Bangladesh. Prices are in Bangladeshi Taka (৳) and are whole numbers -- never write decimals or paisa. Customers mostly shop on mid-range Android phones over mobile data. Write plainly, in the kind of English a busy shop owner reads quickly. Avoid marketing jargon.`;

function systemPrompt(role: string): string {
  return `${HOUSE_STYLE}\n\n${role}\n\n${UNTRUSTED_CONTENT_RULE}\n\n${HONESTY_RULE}`;
}

/* -------------------------------------------------------------------------- */
/* 1. Understanding the instruction                                           */
/* -------------------------------------------------------------------------- */

export interface ParsedCommand {
  /** A product id from the shortlist, or null when nothing matched. */
  productId: string | null;
  /** How the match was made, or why it failed. Shown to the operator. */
  productNote: string;
  objective: "purchase" | "traffic" | "awareness" | "engagement";
  /** Whole Taka, or null when the instruction did not say. */
  budget: number | null;
  /** Days, or null when the instruction did not say. */
  days: number | null;
  platform: "meta" | "facebook" | "instagram" | "messenger";
  /** What the operator must still answer before a plan can be built. Empty
   * when safe defaults covered everything. */
  missing: string[];
  /** One sentence back to the operator, confirming what was understood. */
  understanding: string;
}

const COMMAND_SCHEMA = {
  type: "object",
  properties: {
    product_id: {
      type: ["string", "null"],
      description: "The id of the matching product from the list, or null if none matched.",
    },
    product_note: { type: "string" },
    objective: {
      type: "string",
      enum: ["purchase", "traffic", "awareness", "engagement"],
    },
    budget_taka: { type: ["integer", "null"] },
    days: { type: ["integer", "null"] },
    platform: {
      type: "string",
      enum: ["meta", "facebook", "instagram", "messenger"],
    },
    missing: { type: "array", items: { type: "string" } },
    understanding: { type: "string" },
  },
  required: [
    "product_id",
    "product_note",
    "objective",
    "budget_taka",
    "days",
    "platform",
    "missing",
    "understanding",
  ],
  additionalProperties: false,
} as const;

/**
 * Turns "promote the classic shirt for 7 days with ৳2000" into fields.
 *
 * The product is chosen from a list rather than named freely, so the answer is
 * an id this shop actually has. What the instruction does not say is left
 * null: a missing budget is a question for the operator, never a number the
 * system picks on their behalf, because that number is what gets spent.
 */
export async function parseCommand(
  instruction: string,
  products: MarketableProduct[],
  provider?: TextProvider
): Promise<TextResult<ParsedCommand>> {
  const engine = provider ?? (await getTextProvider());
  if (!engine) throw new ProviderNotConfigured();

  const catalogue = products
    .map(
      (p) =>
        `${p.id} | ${p.name} | ৳${p.price} | stock ${p.stock} | ${p.categoryName ?? "uncategorised"} | ${p.unitsSold90d} sold in 90d`
    )
    .join("\n");

  const raw = await engine.generate<{
    product_id: string | null;
    product_note: string;
    objective: ParsedCommand["objective"];
    budget_taka: number | null;
    days: number | null;
    platform: ParsedCommand["platform"];
    missing: string[];
    understanding: string;
  }>({
    system: systemPrompt(
      `Your task is to read one instruction from the shop's owner and work out exactly what they asked for. Choose the product from the supplied list by its id -- never invent an id, and if nothing in the list plausibly matches, return null and say so in product_note. If the instruction names a superlative such as "best selling", pick the product the data supports and explain that choice.

Leave budget_taka and days null when the instruction does not state them. Do not guess a budget: money is the operator's decision. Add a short question to "missing" for anything genuinely required that you could not determine. Default the objective to "purchase" and the platform to "meta" unless the instruction says otherwise -- those are defaults, not guesses, and need not be listed as missing.`
    ),
    prompt: `The shop's products:\n${fence("shop_data", catalogue)}\n\nThe owner's instruction:\n${fence("shop_data", instruction)}`,
    schema: COMMAND_SCHEMA,
    shapeName: "parsed_command",
    effort: "medium",
    maxTokens: 2000,
  });

  const allowed = products.map((p) => p.id);
  const value = raw.value;

  return {
    ...raw,
    value: {
      productId:
        typeof value.product_id === "string" && allowed.includes(value.product_id)
          ? value.product_id
          : null,
      productNote: text(value.product_note, 300),
      objective: value.objective ?? "purchase",
      budget: typeof value.budget_taka === "number" ? Math.round(value.budget_taka) : null,
      days: typeof value.days === "number" ? Math.round(value.days) : null,
      platform: value.platform ?? "meta",
      missing: Array.isArray(value.missing) ? value.missing.map((m) => text(m, 160)) : [],
      understanding: text(value.understanding, 400),
    },
  };
}

/* -------------------------------------------------------------------------- */
/* 2. Research                                                                */
/* -------------------------------------------------------------------------- */

export interface ResearchBrief {
  productSummary: string;
  customerProblems: string[];
  angles: { name: string; rationale: string; evidence: string }[];
  offerNotes: string;
  risks: string[];
}

const RESEARCH_SCHEMA = {
  type: "object",
  properties: {
    product_summary: { type: "string" },
    customer_problems: { type: "array", items: { type: "string" } },
    angles: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          rationale: { type: "string" },
          evidence: {
            type: "string",
            description: "Prefix with FACT, ASSUMPTION or HYPOTHESIS.",
          },
        },
        required: ["name", "rationale", "evidence"],
        additionalProperties: false,
      },
    },
    offer_notes: { type: "string" },
    risks: { type: "array", items: { type: "string" } },
  },
  required: ["product_summary", "customer_problems", "angles", "offer_notes", "risks"],
  additionalProperties: false,
} as const;

/** Reads one product the way a marketer would before writing anything: what
 * it is, who it is for, what would make somebody buy it, and what might stop
 * them. Everything seller- or shopper-written goes in fenced. */
export async function research(
  product: ProductBrief,
  lessons: PriorLesson[],
  audience: AudienceShape,
  provider?: TextProvider
): Promise<TextResult<ResearchBrief>> {
  const engine = provider ?? (await getTextProvider());
  if (!engine) throw new ProviderNotConfigured();

  const facts = [
    `Name: ${product.name}`,
    `Price: ৳${product.price}`,
    product.oldPrice && product.oldPrice > product.price
      ? `Previous price: ৳${product.oldPrice}`
      : null,
    `Stock on hand: ${product.stock}`,
    `Category: ${product.categoryName ?? "uncategorised"}`,
    product.brandName ? `Brand: ${product.brandName}` : null,
    product.freeDelivery ? "This product ships free." : "Standard delivery charges apply.",
    `Units sold in the last 90 days: ${product.unitsSold90d}`,
    `Revenue in the last 90 days: ৳${product.revenue90d}`,
    product.averageRating !== null
      ? `Average rating: ${product.averageRating} from ${product.reviewCount} written reviews`
      : "No ratings yet.",
  ]
    .filter(Boolean)
    .join("\n");

  const history = lessons.length
    ? lessons
        .map(
          (l) =>
            `${l.productName ?? "unknown product"} | angle: ${l.angle ?? "n/a"} | spend ৳${l.spend} | ${l.purchases} purchases | ৳${l.revenue} revenue | ${l.confidence}: ${l.conclusion}`
        )
        .join("\n")
    : "(this shop has not run a measured campaign before)";

  const shape = `Orders in 90 days: ${audience.orders90d}. Distinct buyers: ${audience.buyers90d}. Repeat rate: ${audience.repeatRate}. Average order value: ৳${audience.averageOrderValue}. Busiest districts: ${
    audience.topDistricts.map((d) => `${d.district} (${d.orders})`).join(", ") || "not enough data"
  }.`;

  const raw = await engine.generate<{
    product_summary: string;
    customer_problems: string[];
    angles: { name: string; rationale: string; evidence: string }[];
    offer_notes: string;
    risks: string[];
  }>({
    system: systemPrompt(
      `Your task is to produce a short marketing research brief for one product, for a shop selling in Bangladesh.

Propose between three and six distinct marketing angles. An angle is a reason somebody would buy, not a slogan. Every angle must carry an evidence line that begins with FACT (something the supplied data shows), ASSUMPTION (something you believe but cannot see) or HYPOTHESIS (something worth testing). Do not describe an assumption as a fact because it sounds more persuasive.

If the product has no reviews and little sales history, say so plainly in the risks -- a new product with no proof is a real constraint on what the advertising can claim, not something to write around.`
    ),
    prompt: `Verified figures from the shop's database:\n${fence("shop_data", facts)}

The seller's own description:\n${fence("shop_data", product.description)}

The seller's specification list:\n${fence("shop_data", product.attributes.join("\n"))}

Recent customer reviews:\n${fence("shop_data", product.reviewExcerpts.join("\n---\n"))}

What this shop learned from past campaigns:\n${fence("shop_data", history)}

The shape of the customer base:\n${fence("shop_data", shape)}`,
    schema: RESEARCH_SCHEMA,
    shapeName: "research_brief",
    effort: "high",
  });

  return {
    ...raw,
    value: {
      productSummary: text(raw.value.product_summary, 800),
      customerProblems: (raw.value.customer_problems ?? []).map((p) => text(p, 240)),
      angles: (raw.value.angles ?? []).map((a) => ({
        name: text(a.name, 80),
        rationale: text(a.rationale, 400),
        evidence: text(a.evidence, 300),
      })),
      offerNotes: text(raw.value.offer_notes, 600),
      risks: (raw.value.risks ?? []).map((r) => text(r, 240)),
    },
  };
}

/* -------------------------------------------------------------------------- */
/* 3. Strategy                                                                */
/* -------------------------------------------------------------------------- */

export interface Strategy {
  campaignName: string;
  audienceHypothesis: string;
  positioning: string;
  offer: string;
  messaging: string[];
  primaryCta: string;
  testingPlan: string;
  chosenAngles: string[];
}

const STRATEGY_SCHEMA = {
  type: "object",
  properties: {
    campaign_name: { type: "string" },
    audience_hypothesis: { type: "string" },
    positioning: { type: "string" },
    offer: { type: "string" },
    messaging: { type: "array", items: { type: "string" } },
    primary_cta: { type: "string" },
    testing_plan: { type: "string" },
    chosen_angles: { type: "array", items: { type: "string" } },
  },
  required: [
    "campaign_name",
    "audience_hypothesis",
    "positioning",
    "offer",
    "messaging",
    "primary_cta",
    "testing_plan",
    "chosen_angles",
  ],
  additionalProperties: false,
} as const;

/** Turns the brief into a position to take and a plan for finding out whether
 * it was the right one. */
export async function strategy(
  brief: ResearchBrief,
  product: ProductBrief,
  budget: number,
  days: number,
  provider?: TextProvider
): Promise<TextResult<Strategy>> {
  const engine = provider ?? (await getTextProvider());
  if (!engine) throw new ProviderNotConfigured();

  const briefText = [
    brief.productSummary,
    "",
    "Customer problems:",
    ...brief.customerProblems.map((p) => `- ${p}`),
    "",
    "Angles:",
    ...brief.angles.map((a) => `- ${a.name}: ${a.rationale} [${a.evidence}]`),
    "",
    `Offer notes: ${brief.offerNotes}`,
    "",
    "Risks:",
    ...brief.risks.map((r) => `- ${r}`),
  ].join("\n");

  const raw = await engine.generate<{
    campaign_name: string;
    audience_hypothesis: string;
    positioning: string;
    offer: string;
    messaging: string[];
    primary_cta: string;
    testing_plan: string;
    chosen_angles: string[];
  }>({
    system: systemPrompt(
      `Your task is to turn a research brief into a campaign strategy that can be tested within a stated budget and duration.

The budget is fixed and is not yours to change -- design a plan that fits inside it. With a small budget, prefer testing few things properly over testing many things badly, and say which angles you are deliberately leaving for later.

The offer must be something the shop can actually honour from the data given. Do not invent a discount, a free gift, a delivery promise or a guarantee that is not already true of this product.

campaign_name should be short and recognisable in a list, e.g. "Classic Shirt — Comfort Test 01".`
    ),
    prompt: `The research brief:\n${fence("shop_data", briefText)}

Fixed constraints:
- Product: ${product.name} at ৳${product.price}
- Stock available: ${product.stock}
- Total budget: ৳${budget}
- Duration: ${days} days
- Delivery: ${product.freeDelivery ? "this product ships free" : "standard delivery charges apply"}`,
    schema: STRATEGY_SCHEMA,
    shapeName: "campaign_strategy",
    effort: "high",
  });

  return {
    ...raw,
    value: {
      campaignName: text(raw.value.campaign_name, 120),
      audienceHypothesis: text(raw.value.audience_hypothesis, 600),
      positioning: text(raw.value.positioning, 600),
      offer: text(raw.value.offer, 400),
      messaging: (raw.value.messaging ?? []).map((m) => text(m, 240)),
      primaryCta: text(raw.value.primary_cta, 80),
      testingPlan: text(raw.value.testing_plan, 800),
      chosenAngles: (raw.value.chosen_angles ?? []).map((a) => text(a, 80)),
    },
  };
}

/* -------------------------------------------------------------------------- */
/* 4. Creatives                                                               */
/* -------------------------------------------------------------------------- */

export interface CreativeBrief {
  label: string;
  angle: string;
  hook: string;
  headline: string;
  body: string;
  script: string;
  visualDirection: string;
  cta: string;
  format: "image" | "video" | "carousel";
}

const CREATIVES_SCHEMA = {
  type: "object",
  properties: {
    creatives: {
      type: "array",
      items: {
        type: "object",
        properties: {
          angle: { type: "string" },
          hook: { type: "string" },
          headline: { type: "string" },
          body: { type: "string" },
          script: { type: "string" },
          visual_direction: { type: "string" },
          cta: { type: "string" },
          format: { type: "string", enum: ["image", "video", "carousel"] },
        },
        required: [
          "angle",
          "hook",
          "headline",
          "body",
          "script",
          "visual_direction",
          "cta",
          "format",
        ],
        additionalProperties: false,
      },
    },
  },
  required: ["creatives"],
  additionalProperties: false,
} as const;

/** Writes the adverts themselves, one per angle worth testing.
 *
 * Numbered on our side rather than the model's, so "Creative #03" means the
 * same thing in the database, on the screen and in tomorrow's report. */
export async function creatives(
  plan: Strategy,
  product: ProductBrief,
  count: number,
  provider?: TextProvider
): Promise<TextResult<CreativeBrief[]>> {
  const engine = provider ?? (await getTextProvider());
  if (!engine) throw new ProviderNotConfigured();

  const planText = [
    `Campaign: ${plan.campaignName}`,
    `Audience hypothesis: ${plan.audienceHypothesis}`,
    `Positioning: ${plan.positioning}`,
    `Offer: ${plan.offer}`,
    `Call to action: ${plan.primaryCta}`,
    "Messaging:",
    ...plan.messaging.map((m) => `- ${m}`),
    `Angles to cover: ${plan.chosenAngles.join(", ")}`,
  ].join("\n");

  const raw = await engine.generate<{
    creatives: {
      angle: string;
      hook: string;
      headline: string;
      body: string;
      script: string;
      visual_direction: string;
      cta: string;
      format: CreativeBrief["format"];
    }[];
  }>({
    system: systemPrompt(
      `Your task is to write ${count} distinct advert concepts for one product.

Each must test a genuinely different idea. Two concepts with the same argument and different wording are one concept, and wasting half the budget discovering that is the failure to avoid.

Write the hook as the first line somebody hears or reads in the first two seconds. Write the script as what actually happens on screen, shot by shot, in plain sentences. Keep the headline short enough to survive a phone screen.

Every claim must be supportable from the product data. No invented reviews, no "thousands sold", no countdown that is not real, no guarantee the shop has not offered. If a concept would be stronger with proof the shop does not have, write the concept without it.`
    ),
    prompt: `The strategy:\n${fence("shop_data", planText)}

The product:\n${fence("shop_data", `${product.name} at ৳${product.price}. ${product.description ?? ""}`)}

Facts you may rely on: stock ${product.stock}; ${product.unitsSold90d} units sold in the last 90 days; ${
      product.averageRating !== null
        ? `rated ${product.averageRating} across ${product.reviewCount} reviews`
        : "no ratings yet"
    }; ${product.freeDelivery ? "ships free" : "standard delivery charges"}.`,
    schema: CREATIVES_SCHEMA,
    shapeName: "creative_briefs",
    effort: "high",
  });

  const list = (raw.value.creatives ?? []).slice(0, count).map((c, index) => ({
    label: `Creative #${String(index + 1).padStart(2, "0")}`,
    angle: text(c.angle, 80),
    hook: text(c.hook, 240),
    headline: text(c.headline, 120),
    body: text(c.body, 600),
    script: text(c.script, 1200),
    visualDirection: text(c.visual_direction, 600),
    cta: text(c.cta, 80),
    format: (["image", "video", "carousel"] as const).includes(c.format) ? c.format : "image",
  }));

  return { ...raw, value: list };
}
