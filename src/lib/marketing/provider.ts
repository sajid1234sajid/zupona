/** Where the Marketing OS gets its thinking done.
 *
 * Deliberately an interface rather than a direct call to one vendor. The
 * specification asks for text, image and video generation to be replaceable
 * without touching the agents that use them, because the video providers in
 * particular are a moving target. Only text is implemented today; the other
 * two are declared so that adding one later is a new file rather than a
 * rewrite of every caller.
 *
 * The API key lives in `site_settings` beside the Meta token, not in a Worker
 * secret. That is deliberate: the shop owner can paste a new key into the
 * admin panel without a deploy, which is the same reasoning that put the SMS
 * and pixel credentials there. It is listed in the settings page's `SECRETS`
 * set, so it is never echoed back to a browser and the audit log records only
 * that it changed.
 *
 * Server-only. Nothing here may be imported by a client component -- the key
 * would travel with it. */

import Anthropic from "@anthropic-ai/sdk";
import { getDB } from "@/lib/db";

/** The model the agents run on. Named here rather than at each call site so
 * that changing it is one edit and shows up in every `marketing_runs` row. */
export const TEXT_MODEL = "claude-opus-5";

/** How hard the model is asked to think. Marketing plans are judgement, not
 * arithmetic, and a thin plan wastes the budget it recommends -- so this sits
 * above the middle rather than at it. */
export type Effort = "low" | "medium" | "high" | "xhigh" | "max";

export class ProviderNotConfigured extends Error {
  constructor(message = "No AI provider is configured. Add an API key in Settings.") {
    super(message);
    this.name = "ProviderNotConfigured";
  }
}

/** A failure that came back from the model rather than from our own code.
 * Kept separate so the UI can offer Retry for one and not the other. */
export class ProviderFailed extends Error {
  readonly retryable: boolean;
  constructor(message: string, retryable = true) {
    super(message);
    this.name = "ProviderFailed";
    this.retryable = retryable;
  }
}

/** A JSON Schema object describing exactly what an agent must return.
 * Loose typing on purpose: these are handed to the API verbatim. */
export type OutputSchema = Record<string, unknown>;

export interface TextRequest {
  /** The agent's standing instructions. Stable across calls, so it caches. */
  system: string;
  /** This particular question, including any shop data it needs. */
  prompt: string;
  /** What a valid answer looks like. Enforced by the API, not by hope. */
  schema: OutputSchema;
  /** A name for the shape, e.g. `research_brief`. Appears in the request. */
  shapeName: string;
  effort?: Effort;
  maxTokens?: number;
}

export interface TextResult<T> {
  value: T;
  model: string;
  inputTokens: number;
  outputTokens: number;
}

export interface TextProvider {
  readonly name: string;
  /** Returns a value matching `schema`, or throws. Never returns prose. */
  generate<T>(request: TextRequest): Promise<TextResult<T>>;
}

/* -------------------------------------------------------------------------- */
/* Credentials                                                                */
/* -------------------------------------------------------------------------- */

/** Reads the key straight from D1 rather than through the settings cache.
 * A credential has no business sitting in a cached object that other code
 * passes around, and this runs once per agent call, not once per page. */
async function readApiKey(): Promise<string | null> {
  try {
    const db = await getDB();
    const row = await db
      .prepare("SELECT value FROM site_settings WHERE key = 'anthropic_api_key'")
      .first<{ value: string }>();
    return row?.value?.trim() || null;
  } catch (error) {
    console.error("anthropic key unreadable", error);
    return null;
  }
}

/** Whether the shop can actually run an agent, without reading the key out.
 * The Marketing OS uses this to decide between real work and Demo Mode. */
export async function textProviderConfigured(): Promise<boolean> {
  return (await readApiKey()) !== null;
}

/* -------------------------------------------------------------------------- */
/* The Claude provider                                                        */
/* -------------------------------------------------------------------------- */

/** Structured output is obtained through a strict tool rather than by asking
 * for JSON in the prompt and hoping.
 *
 * With `strict: true` the API guarantees the tool input validates against the
 * schema, which turns "the model wrote prose today" from a class of bug into
 * something that cannot happen. The tool is never executed -- it exists only
 * as the shape of the answer. */
class AnthropicTextProvider implements TextProvider {
  readonly name = "anthropic";
  private readonly client: Anthropic;

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey });
  }

  async generate<T>(request: TextRequest): Promise<TextResult<T>> {
    let response: Anthropic.Message;

    try {
      response = await this.client.messages.create({
        model: TEXT_MODEL,
        max_tokens: request.maxTokens ?? 16000,
        output_config: { effort: request.effort ?? "high" },
        system: request.system,
        messages: [{ role: "user", content: request.prompt }],
        tools: [
          {
            name: request.shapeName,
            description: "Return the result in exactly this shape.",
            strict: true,
            input_schema: request.schema as Anthropic.Tool["input_schema"],
          },
        ],
        // Opus 5 still honours a forced tool, which is what makes the answer
        // a structure rather than a paragraph about one.
        tool_choice: { type: "tool", name: request.shapeName },
      });
    } catch (error) {
      if (error instanceof Anthropic.AuthenticationError) {
        throw new ProviderNotConfigured("That API key was refused. Check it in Settings.");
      }
      if (error instanceof Anthropic.RateLimitError) {
        throw new ProviderFailed("The AI provider is rate limiting us. Try again shortly.");
      }
      if (error instanceof Anthropic.APIError) {
        throw new ProviderFailed(`The AI provider returned ${error.status}: ${error.message}`);
      }
      throw new ProviderFailed(error instanceof Error ? error.message : "The AI call failed.");
    }

    // A refusal is an answer, not a crash, and saying so beats showing an
    // empty plan that looks like the model simply had no ideas.
    if (response.stop_reason === "refusal") {
      throw new ProviderFailed(
        "The AI declined to answer this request. Try rewording the instruction.",
        false
      );
    }

    const block = response.content.find(
      (entry): entry is Anthropic.ToolUseBlock => entry.type === "tool_use"
    );

    if (!block) {
      throw new ProviderFailed("The AI answered in the wrong shape. Try again.");
    }

    return {
      value: block.input as T,
      model: response.model,
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
    };
  }
}

/** The configured text provider, or null when the shop has no key yet.
 *
 * Returning null rather than throwing is what lets the Command Center fall
 * back to Demo Mode instead of showing an error to someone who has simply not
 * finished setting the system up. */
export async function getTextProvider(): Promise<TextProvider | null> {
  const key = await readApiKey();
  return key ? new AnthropicTextProvider(key) : null;
}
