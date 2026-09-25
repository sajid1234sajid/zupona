/** Demo Mode: the whole flow, with nobody's model and nobody's money.
 *
 * A shop that has not pasted in an API key can still press every button and
 * see exactly what the system does -- the steps, the approval screen, the
 * campaign draft -- which is the only honest way to ask somebody to trust it
 * with a budget later.
 *
 * Two rules hold this apart from the real thing.
 *
 * Every row it writes carries `is_demo = 1`, and every query that reports a
 * number filters those out. A shop trying the system out must never find
 * invented spend averaged into its actual ROAS.
 *
 * And nothing here fabricates evidence. The copy below is deliberately
 * generic, built from figures the shop's own database already holds. There are
 * no invented reviews, no "2,000 happy customers", no discount that was never
 * offered -- because a demo that shows the system inventing proof is a demo
 * that teaches the operator to expect it. */

import type { MarketableProduct, ProductBrief } from "./data";
import type { CreativeBrief, ParsedCommand, ResearchBrief, Strategy } from "./agents";

/** Pulls a budget out of an instruction without a model.
 *
 * Handles the shapes a Bangladeshi operator actually types -- `৳2000`,
 * `2,000 taka`, `Tk 2000`, `2k` -- because Demo Mode is worth nothing if it
 * cannot understand the sentence the real system would. */
function readBudget(instruction: string): number | null {
  const thousands = instruction.match(/(\d+(?:\.\d+)?)\s*k\b/i);
  if (thousands) return Math.round(Number(thousands[1]) * 1000);

  const plain = instruction.match(/(?:৳|tk\.?|taka|budget(?:\s+of)?)\s*([\d,]+)/i);
  if (plain) return Number(plain[1].replace(/,/g, "")) || null;

  const trailing = instruction.match(/([\d,]+)\s*(?:৳|tk\.?|taka)/i);
  if (trailing) return Number(trailing[1].replace(/,/g, "")) || null;

  return null;
}

function readDays(instruction: string): number | null {
  const week = /\bweek\b/i.test(instruction) ? 7 : null;
  const days = instruction.match(/(\d+)\s*(?:day|days)\b/i);
  if (days) return Number(days[1]) || null;
  return week;
}

/** Matches an instruction to a product by the words they share.
 *
 * Crude next to a model, and deliberately so: it is transparent about when it
 * has not found anything, which is the behaviour that matters here. */
function matchProduct(
  instruction: string,
  products: MarketableProduct[]
): { product: MarketableProduct | null; note: string } {
  const words = instruction
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 3);

  let best: { product: MarketableProduct; score: number } | null = null;

  for (const product of products) {
    const name = product.name.toLowerCase();
    const score = words.filter((word) => name.includes(word)).length;
    if (score > 0 && (!best || score > best.score)) best = { product, score };
  }

  if (best) {
    return { product: best.product, note: `Matched "${best.product.name}" by name.` };
  }

  if (/best.?sell|top.?sell|most popular/i.test(instruction) && products.length) {
    return {
      product: products[0],
      note: `No product was named, so the best seller by units in the last 90 days was used: "${products[0].name}".`,
    };
  }

  return {
    product: null,
    note: "No product in the catalogue matched that instruction. Name the product and try again.",
  };
}

export const demoPlan = {
  parseCommand(instruction: string, products: MarketableProduct[]): ParsedCommand {
    const { product, note } = matchProduct(instruction, products);
    const budget = readBudget(instruction);
    const days = readDays(instruction);

    return {
      productId: product?.id ?? null,
      productNote: note,
      objective: "purchase",
      budget,
      days,
      platform: /instagram/i.test(instruction)
        ? "instagram"
        : /messenger/i.test(instruction)
          ? "messenger"
          : "meta",
      missing: [],
      understanding: product
        ? `Demo Mode: promote ${product.name}${budget ? ` with ৳${budget.toLocaleString("en-BD")}` : ""}${days ? ` over ${days} days` : ""}.`
        : "Demo Mode: no product was identified in that instruction.",
    };
  },

  research(product: ProductBrief): ResearchBrief {
    const proven = product.unitsSold90d > 0;

    return {
      productSummary:
        `DEMO DATA — no AI provider is configured, so this brief is a worked example rather than analysis. ` +
        `${product.name} sells at ৳${product.price.toLocaleString("en-BD")} with ${product.stock} in stock` +
        `${proven ? ` and ${product.unitsSold90d} units sold in the last 90 days` : ` and no recorded sales in the last 90 days`}.`,
      customerProblems: [
        "The shopper cannot judge quality from a photograph alone.",
        "Delivery cost and timing are unclear before checkout.",
        "The shopper has not heard of this shop and has no reason to trust it yet.",
      ],
      angles: [
        {
          name: "Demonstration",
          rationale: "Show the product being used, so quality is visible rather than claimed.",
          evidence: "HYPOTHESIS: untested for this product.",
        },
        {
          name: "Delivery clarity",
          rationale: product.freeDelivery
            ? "This product ships free, which is a real and checkable advantage."
            : "State the delivery charge honestly up front to reduce checkout drop-off.",
          evidence: `FACT: free_delivery is ${product.freeDelivery ? "on" : "off"} for this product.`,
        },
        {
          name: "Price anchoring",
          rationale: "Place the price beside what the shopper expected to pay.",
          evidence:
            product.oldPrice && product.oldPrice > product.price
              ? `FACT: the previous price was ৳${product.oldPrice.toLocaleString("en-BD")}.`
              : "ASSUMPTION: no previous price is recorded, so any comparison would have to be invented — do not make one.",
        },
      ],
      offerNotes:
        "DEMO DATA — no offer is proposed. A real plan would only offer what this shop can honour.",
      risks: [
        proven
          ? "Past sales do not prove that paid traffic will convert at the same rate."
          : "This product has no sales history, so every estimate here is a guess.",
        product.reviewCount === 0
          ? "There are no reviews yet, so the advertising cannot lean on social proof."
          : `There are ${product.reviewCount} written reviews to draw on.`,
        "This is Demo Mode. Add an API key in Settings before trusting any of it.",
      ],
    };
  },

  strategy(product: ProductBrief): Strategy {
    return {
      campaignName: `${product.name} — Demo Test 01`,
      audienceHypothesis:
        "DEMO DATA — a real plan would propose an audience from this shop's own order history.",
      positioning: `${product.name}, sold honestly at ৳${product.price.toLocaleString("en-BD")}.`,
      offer: product.freeDelivery
        ? "Free delivery, which is already true of this product."
        : "No special offer. Standard delivery charges apply.",
      messaging: [
        "Show the product clearly and at its real price.",
        "Say what delivery costs before the shopper reaches checkout.",
        "Make no claim the product page does not already support.",
      ],
      primaryCta: "Order from Zupona",
      testingPlan:
        "DEMO DATA — a real plan would test one variable at a time against cost per purchase.",
      chosenAngles: ["Demonstration", "Delivery clarity"],
    };
  },

  creatives(product: ProductBrief): CreativeBrief[] {
    const price = `৳${product.price.toLocaleString("en-BD")}`;
    const seeds: { angle: string; hook: string; visual: string; format: CreativeBrief["format"] }[] =
      [
        {
          angle: "Demonstration",
          hook: `This is what ${product.name} actually looks like.`,
          visual: "Hold the product in frame, unedited, turning it slowly in daylight.",
          format: "video",
        },
        {
          angle: "Delivery clarity",
          hook: product.freeDelivery ? "Delivered free." : "Delivery charge shown before you pay.",
          visual: "Plain text over the product photograph. No stock imagery.",
          format: "image",
        },
        {
          angle: "Price",
          hook: `${product.name} — ${price}.`,
          visual: "The product on a plain background with the price set large.",
          format: "image",
        },
        {
          angle: "In use",
          hook: "One week of ordinary use.",
          visual: "The product in a real home, being used rather than posed with.",
          format: "video",
        },
        {
          angle: "Detail",
          hook: "Look closely at the stitching.",
          visual: "Slow close-ups of the parts a photograph usually hides.",
          format: "carousel",
        },
      ];

    return seeds.map((seed, index) => ({
      label: `Creative #${String(index + 1).padStart(2, "0")}`,
      angle: seed.angle,
      hook: seed.hook,
      headline: `${product.name} — ${price}`,
      body: `DEMO DATA. ${product.name}, ${price}${product.freeDelivery ? ", delivered free" : ""}. Written without an AI provider configured.`,
      script: `DEMO DATA — a worked example, not a generated script.\n\n1. ${seed.hook}\n2. ${seed.visual}\n3. Show the price: ${price}.\n4. Close on: Order from Zupona.`,
      visualDirection: seed.visual,
      cta: "Order from Zupona",
      format: seed.format,
    }));
  },
};
