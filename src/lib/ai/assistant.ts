/** The admin assistant: ask it anything about the shop.
 *
 * It answers in two passes rather than through a tool-calling loop. The first
 * pass reads the question and names which readings it needs; this file fetches
 * those; the second pass answers with them in hand.
 *
 * That shape is deliberate. Tool calling is expressed differently by every
 * vendor -- and doing it their way would mean three implementations of the
 * same loop, each breaking on its own schedule. Two plain requests behave
 * identically on all three, and the round trip costs less than the divergence
 * would. It also makes the audit trail exact: what the assistant looked at is
 * a list this file wrote, not a transcript of what a model claims it did.
 *
 * The rules that hold it honest:
 *
 * It cannot invent figures, because it is only ever shown figures this shop's
 * own database returned, fenced as data.
 *
 * It cannot reach anything not on the menu in `readings.ts`, because it names
 * a reading rather than writing a query.
 *
 * It cannot change anything. A proposal is a description of work for a human
 * to approve, stored as text; nothing in this file acts on one. */

import { getTextProvider, type TextProvider, ProviderNotConfigured } from "./provider";
import { READINGS, fetchReadings, isReadingName, type ReadingRequest } from "./readings";
import { fence, UNTRUSTED_CONTENT_RULE, text } from "@/lib/marketing/safety";

const MENU = Object.entries(READINGS)
  .map(([name, description]) => `${name} — ${description}`)
  .join("\n");

const HOUSE = `You are the assistant inside Zupona's admin panel. Zupona is an online shop in Bangladesh. Money is whole Bangladeshi Taka (৳) with no decimals or paisa. The person asking is the shop's owner or their staff.

Answer plainly and briefly, the way a capable colleague would. No marketing language, no filler, no restating the question back.`;

/* -------------------------------------------------------------------------- */
/* Pass one: what does this question need?                                    */
/* -------------------------------------------------------------------------- */

const PLAN_SCHEMA = {
  type: "object",
  properties: {
    readings: {
      type: "array",
      description: "The readings needed, at most four. Empty if none are needed.",
      items: {
        type: "object",
        properties: {
          name: { type: "string", enum: Object.keys(READINGS) },
          query: {
            type: ["string", "null"],
            description: "Search text for readings that take one, otherwise null.",
          },
        },
        required: ["name", "query"],
        additionalProperties: false,
      },
    },
    needs_nothing: {
      type: "boolean",
      description: "True when the question can be answered without shop data at all.",
    },
  },
  required: ["readings", "needs_nothing"],
  additionalProperties: false,
} as const;

async function planReadings(
  question: string,
  history: string,
  provider: TextProvider
): Promise<ReadingRequest[]> {
  const result = await provider.generate<{
    readings: { name: string; query: string | null }[];
    needs_nothing: boolean;
  }>({
    system: `${HOUSE}

Your only task right now is to decide which of the shop's readings are needed to answer the question. Do not answer it.

The readings available:
${MENU}

Pick as few as will do. Ask for a reading only if the answer genuinely depends on it -- each one costs a database trip the owner is waiting on. If the question is conversational, or a follow-up you can answer from what was already said, set needs_nothing to true and return an empty list.

${UNTRUSTED_CONTENT_RULE}`,
    prompt: `Earlier in this conversation:\n${fence("shop_data", history || "(nothing yet)")}\n\nThe question:\n${fence("shop_data", question)}`,
    schema: PLAN_SCHEMA,
    shapeName: "reading_plan",
    effort: "low",
    maxTokens: 1000,
  });

  if (result.value.needs_nothing) return [];

  return (result.value.readings ?? [])
    .filter((entry) => isReadingName(entry.name))
    .slice(0, 4)
    .map((entry) => ({
      name: entry.name as ReadingRequest["name"],
      query: entry.query?.trim() || undefined,
    }));
}

/* -------------------------------------------------------------------------- */
/* Pass two: answer                                                           */
/* -------------------------------------------------------------------------- */

export interface Proposal {
  summary: string;
  detail: string;
  /** What area of the shop it would touch, so the operator can judge it. */
  area: string;
}

export interface AssistantAnswer {
  answer: string;
  /** What the answer rests on, labelled so a guess cannot pass as a figure. */
  confidence: "confirmed" | "likely" | "possible" | "unknown";
  evidence: string[];
  /** Work it is offering to do. Inert -- nothing runs without a human. */
  proposals: Proposal[];
  readingsUsed: string[];
  model: string;
  inputTokens: number;
  outputTokens: number;
}

const ANSWER_SCHEMA = {
  type: "object",
  properties: {
    answer: { type: "string" },
    confidence: { type: "string", enum: ["confirmed", "likely", "possible", "unknown"] },
    evidence: {
      type: "array",
      description: "The specific figures the answer rests on. Empty if none.",
      items: { type: "string" },
    },
    proposals: {
      type: "array",
      description: "Actions you are offering to take. Empty unless the owner would want one.",
      items: {
        type: "object",
        properties: {
          summary: { type: "string" },
          detail: { type: "string" },
          area: { type: "string" },
        },
        required: ["summary", "detail", "area"],
        additionalProperties: false,
      },
    },
  },
  required: ["answer", "confidence", "evidence", "proposals"],
  additionalProperties: false,
} as const;

/**
 * Answers one question.
 *
 * `history` is the conversation so far, already trimmed by the caller. It is
 * fenced like everything else: a previous answer is still text that came from
 * a model, and is not an instruction to this one.
 */
export async function ask(
  question: string,
  history: string,
  provider?: TextProvider
): Promise<AssistantAnswer> {
  const engine = provider ?? (await getTextProvider());
  if (!engine) throw new ProviderNotConfigured();

  const wanted = await planReadings(question, history, engine);
  const readings = await fetchReadings(wanted);

  const data = readings.length
    ? readings
        .map((reading) => `### ${reading.name}\n${JSON.stringify(reading.value, null, 1)}`)
        .join("\n\n")
    : "(nothing was looked up for this question)";

  const result = await engine.generate<{
    answer: string;
    confidence: AssistantAnswer["confidence"];
    evidence: string[];
    proposals: Proposal[];
  }>({
    system: `${HOUSE}

You have been given readings from the shop's own database. Answer the question from them.

Never invent a number. If a figure you need is not in the readings, say plainly that you do not have it and name which reading would answer it -- do not estimate, and do not describe an estimate as a measurement.

Label your confidence honestly: "confirmed" when the readings show it directly, "likely" when they strongly imply it, "possible" when it is one explanation among several, "unknown" when you are missing what you would need.

You may offer to do work, in "proposals". A proposal is a description only: nothing happens until the owner approves it, so describe what you would change and what the effect would be, and never write as though you have already done it. Offer nothing that deletes data, changes credentials, or spends money without saying so in the summary. Leave the list empty when the answer is simply an answer.

${UNTRUSTED_CONTENT_RULE}`,
    prompt: `Earlier in this conversation:\n${fence("shop_data", history || "(nothing yet)")}\n\nReadings from the shop's database:\n${fence("shop_data", data)}\n\nThe question:\n${fence("shop_data", question)}`,
    schema: ANSWER_SCHEMA,
    shapeName: "assistant_answer",
    effort: "high",
  });

  return {
    answer: text(result.value.answer, 4000),
    confidence: result.value.confidence ?? "unknown",
    evidence: (result.value.evidence ?? []).map((entry) => text(entry, 300)).slice(0, 8),
    proposals: (result.value.proposals ?? []).slice(0, 4).map((proposal) => ({
      summary: text(proposal.summary, 200),
      detail: text(proposal.detail, 800),
      area: text(proposal.area, 60),
    })),
    readingsUsed: readings.map((reading) => reading.name),
    model: result.model,
    inputTokens: result.inputTokens,
    outputTokens: result.outputTokens,
  };
}
