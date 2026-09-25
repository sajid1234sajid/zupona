/** Where Zupona's AI thinking gets done, whoever is doing it.
 *
 * The shop owner picks the vendor and pastes the key in Settings; everything
 * above this file asks the same question and gets the same shape of answer
 * back. That matters more here than it would elsewhere, because the sensible
 * choice changes with the task, the price and who is having an outage that
 * morning -- and none of that should reach the code that writes a campaign.
 *
 * Three vendors are wired up. All three can be made to answer in a fixed JSON
 * shape, which is the only feature this layer actually requires:
 *
 *   - Anthropic, through a strict tool. The API validates the arguments
 *     against the schema, so a wrong shape cannot come back.
 *   - OpenAI, through `response_format: json_schema` with `strict`.
 *   - Google, through `responseSchema` with a JSON mime type.
 *
 * Anthropic goes through its official SDK. The other two are plain `fetch`
 * calls on purpose: this is a Cloudflare Worker, both APIs are a single POST,
 * and two more SDKs would be megabytes of bundle bought for nothing.
 *
 * Keys live in `site_settings`, beside the Meta token, so the owner can change
 * one without a deploy. Every one of them is listed in the settings page's
 * `SECRETS` set, so it is written but never read back to a browser and the
 * audit log records only that it changed.
 *
 * Server-only. A client component importing this would carry the key with it. */

import Anthropic from "@anthropic-ai/sdk";
import { getDB } from "@/lib/db";
import { PROVIDERS, isProviderName, type ProviderChoice, type ProviderName } from "./catalog";

export { PROVIDERS } from "./catalog";
export type { ProviderChoice, ProviderName } from "./catalog";

export type Effort = "low" | "medium" | "high" | "xhigh" | "max";

export class ProviderNotConfigured extends Error {
  constructor(message = "No AI provider is configured. Add an API key in Settings.") {
    super(message);
    this.name = "ProviderNotConfigured";
  }
}

/** A failure that came back from the vendor rather than from our own code.
 * Kept separate so the UI can offer Retry for one and not the other. */
export class ProviderFailed extends Error {
  readonly retryable: boolean;
  constructor(message: string, retryable = true) {
    super(message);
    this.name = "ProviderFailed";
    this.retryable = retryable;
  }
}

/** A JSON Schema object describing exactly what an answer must look like.
 * Loosely typed because it is handed to three different APIs verbatim. */
export type OutputSchema = Record<string, unknown>;

export interface TextRequest {
  /** Standing instructions. Stable across calls, so it caches well. */
  system: string;
  /** This particular question, including any shop data it needs. */
  prompt: string;
  /** What a valid answer looks like. Enforced by the vendor, not by hope. */
  schema: OutputSchema;
  /** A name for the shape, e.g. `research_brief`. */
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
  readonly name: ProviderName;
  readonly model: string;
  /** Returns a value matching `schema`, or throws. Never returns prose. */
  generate<T>(request: TextRequest): Promise<TextResult<T>>;
}

/* -------------------------------------------------------------------------- */
/* Which vendor, and with what key                                            */
/* -------------------------------------------------------------------------- */

/** Reads the vendor settings straight from D1 rather than through the settings
 * cache. Credentials have no business sitting in a cached object other code
 * passes around, and this runs once per AI call rather than once per page. */
async function readConfig(): Promise<{ choice: ProviderChoice; key: string | null }> {
  const fallback: ProviderChoice = {
    provider: "anthropic",
    model: PROVIDERS.anthropic.defaultModel,
    hasKey: false,
  };

  try {
    const db = await getDB();
    const { results } = await db
      .prepare(
        `SELECT key, value FROM site_settings
         WHERE key IN ('ai_provider', 'ai_model', 'anthropic_api_key',
                       'openai_api_key', 'google_api_key')`
      )
      .all<{ key: string; value: string }>();

    const map = new Map(results.map((row) => [row.key, row.value?.trim()]));

    const named = map.get("ai_provider");
    const provider: ProviderName = isProviderName(named) ? named : "anthropic";
    const key = map.get(PROVIDERS[provider].settingKey) || null;

    return {
      choice: {
        provider,
        model: map.get("ai_model") || PROVIDERS[provider].defaultModel,
        hasKey: Boolean(key),
      },
      key,
    };
  } catch (error) {
    console.error("ai provider settings unreadable", error);
    return { choice: fallback, key: null };
  }
}

/** Which vendor is selected and whether it can actually run, without reading
 * the key out. The Settings and Marketing screens use this to decide between
 * real work and Demo Mode. */
export async function providerStatus(): Promise<ProviderChoice> {
  return (await readConfig()).choice;
}

/** Which vendors have a key stored, for the settings screen.
 *
 * Presence only. The values never leave this module, which is the same rule
 * the Meta token follows -- a screen that prints "saved" beside an empty box
 * has told the operator everything they need and nothing they could leak. */
export async function storedKeys(): Promise<Record<ProviderName, boolean>> {
  const blank: Record<ProviderName, boolean> = {
    anthropic: false,
    openai: false,
    google: false,
  };

  try {
    const db = await getDB();
    const { results } = await db
      .prepare(
        `SELECT key, value FROM site_settings
         WHERE key IN ('anthropic_api_key', 'openai_api_key', 'google_api_key')`
      )
      .all<{ key: string; value: string }>();

    const present = new Set(
      results.filter((row) => row.value?.trim()).map((row) => row.key)
    );

    return {
      anthropic: present.has("anthropic_api_key"),
      openai: present.has("openai_api_key"),
      google: present.has("google_api_key"),
    };
  } catch (error) {
    console.error("ai key presence unreadable", error);
    return blank;
  }
}

/** Kept for the callers that only ask "can we run at all?". */
export async function textProviderConfigured(): Promise<boolean> {
  return (await readConfig()).choice.hasKey;
}

/* -------------------------------------------------------------------------- */
/* Anthropic                                                                  */
/* -------------------------------------------------------------------------- */

/** Structured output through a strict tool rather than by asking for JSON in
 * the prompt and hoping. The tool is never executed -- it exists only as the
 * shape of the answer. */
class AnthropicProvider implements TextProvider {
  readonly name = "anthropic" as const;
  private readonly client: Anthropic;

  constructor(
    apiKey: string,
    readonly model: string
  ) {
    this.client = new Anthropic({ apiKey });
  }

  async generate<T>(request: TextRequest): Promise<TextResult<T>> {
    let response: Anthropic.Message;

    try {
      response = await this.client.messages.create({
        model: this.model,
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
        tool_choice: { type: "tool", name: request.shapeName },
      });
    } catch (error) {
      throw translate(error, "Anthropic");
    }

    if (response.stop_reason === "refusal") {
      throw new ProviderFailed(
        "The AI declined to answer this request. Try rewording the instruction.",
        false
      );
    }

    const block = response.content.find(
      (entry): entry is Anthropic.ToolUseBlock => entry.type === "tool_use"
    );
    if (!block) throw new ProviderFailed("The AI answered in the wrong shape. Try again.");

    return {
      value: block.input as T,
      model: response.model,
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
    };
  }
}

function translate(error: unknown, vendor: string): Error {
  if (error instanceof Anthropic.AuthenticationError) {
    return new ProviderNotConfigured(`That ${vendor} key was refused. Check it in Settings.`);
  }
  if (error instanceof Anthropic.RateLimitError) {
    return new ProviderFailed(`${vendor} is rate limiting us. Try again shortly.`);
  }
  if (error instanceof Anthropic.APIError) {
    return new ProviderFailed(`${vendor} returned ${error.status}: ${error.message}`);
  }
  return new ProviderFailed(error instanceof Error ? error.message : `The ${vendor} call failed.`);
}

/* -------------------------------------------------------------------------- */
/* Shared plumbing for the fetch-based vendors                                */
/* -------------------------------------------------------------------------- */

/** Long enough for a careful answer, short enough that a hung vendor does not
 * hold a Worker invocation open indefinitely. */
const TIMEOUT_MS = 120_000;

async function postJson(
  url: string,
  body: unknown,
  headers: Record<string, string>,
  vendor: string
): Promise<Record<string, unknown>> {
  let response: Response;

  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (error) {
    if (error instanceof Error && error.name === "TimeoutError") {
      throw new ProviderFailed(`${vendor} took too long to answer. Try again.`);
    }
    throw new ProviderFailed(`Could not reach ${vendor}.`);
  }

  if (!response.ok) {
    const detail = (await response.text().catch(() => "")).slice(0, 300);
    if (response.status === 401 || response.status === 403) {
      throw new ProviderNotConfigured(`That ${vendor} key was refused. Check it in Settings.`);
    }
    if (response.status === 429) {
      throw new ProviderFailed(`${vendor} is rate limiting us. Try again shortly.`);
    }
    throw new ProviderFailed(`${vendor} returned ${response.status}: ${detail}`);
  }

  return (await response.json()) as Record<string, unknown>;
}

/** Model output is untrusted input, and that includes its JSON. A vendor that
 * answers with a truncated object must read as a failed call, not as a plan
 * with missing fields. */
function parseJson<T>(raw: string, vendor: string): T {
  try {
    return JSON.parse(raw) as T;
  } catch {
    throw new ProviderFailed(`${vendor} answered with malformed JSON. Try again.`);
  }
}

/* -------------------------------------------------------------------------- */
/* OpenAI                                                                     */
/* -------------------------------------------------------------------------- */

class OpenAiProvider implements TextProvider {
  readonly name = "openai" as const;

  constructor(
    private readonly apiKey: string,
    readonly model: string
  ) {}

  async generate<T>(request: TextRequest): Promise<TextResult<T>> {
    const payload = await postJson(
      "https://api.openai.com/v1/chat/completions",
      {
        model: this.model,
        max_completion_tokens: request.maxTokens ?? 16000,
        messages: [
          { role: "system", content: request.system },
          { role: "user", content: request.prompt },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: request.shapeName,
            strict: true,
            schema: request.schema,
          },
        },
      },
      { authorization: `Bearer ${this.apiKey}` },
      "OpenAI"
    );

    const choice = (payload.choices as { message?: { content?: string } }[] | undefined)?.[0];
    const content = choice?.message?.content;
    if (!content) throw new ProviderFailed("OpenAI answered with nothing. Try again.");

    const usage = (payload.usage ?? {}) as { prompt_tokens?: number; completion_tokens?: number };

    return {
      value: parseJson<T>(content, "OpenAI"),
      model: String(payload.model ?? this.model),
      inputTokens: usage.prompt_tokens ?? 0,
      outputTokens: usage.completion_tokens ?? 0,
    };
  }
}

/* -------------------------------------------------------------------------- */
/* Google                                                                     */
/* -------------------------------------------------------------------------- */

/** Gemini accepts a subset of JSON Schema and rejects the request outright on
 * keys it does not know -- `additionalProperties` and `strict` among them,
 * which the other two vendors require. Rather than keep three versions of
 * every schema, the unsupported keys are stripped on the way out. */
function forGoogle(schema: unknown): unknown {
  if (Array.isArray(schema)) return schema.map(forGoogle);
  if (schema === null || typeof schema !== "object") return schema;

  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(schema as Record<string, unknown>)) {
    if (key === "additionalProperties" || key === "strict" || key === "$schema") continue;
    // Gemini wants a single type, so a nullable field is declared by its type
    // plus a nullable flag rather than by a list of two.
    if (key === "type" && Array.isArray(value)) {
      const types = value.filter((entry) => entry !== "null");
      out.type = types[0] ?? "string";
      if (types.length !== value.length) out.nullable = true;
      continue;
    }
    out[key] = forGoogle(value);
  }
  return out;
}

class GoogleProvider implements TextProvider {
  readonly name = "google" as const;

  constructor(
    private readonly apiKey: string,
    readonly model: string
  ) {}

  async generate<T>(request: TextRequest): Promise<TextResult<T>> {
    const payload = await postJson(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
        this.model
      )}:generateContent`,
      {
        systemInstruction: { parts: [{ text: request.system }] },
        contents: [{ role: "user", parts: [{ text: request.prompt }] }],
        generationConfig: {
          maxOutputTokens: request.maxTokens ?? 16000,
          responseMimeType: "application/json",
          responseSchema: forGoogle(request.schema),
        },
      },
      { "x-goog-api-key": this.apiKey },
      "Google"
    );

    const candidate = (
      payload.candidates as { content?: { parts?: { text?: string }[] } }[] | undefined
    )?.[0];
    const content = candidate?.content?.parts?.map((part) => part.text ?? "").join("");
    if (!content) throw new ProviderFailed("Google answered with nothing. Try again.");

    const usage = (payload.usageMetadata ?? {}) as {
      promptTokenCount?: number;
      candidatesTokenCount?: number;
    };

    return {
      value: parseJson<T>(content, "Google"),
      model: this.model,
      inputTokens: usage.promptTokenCount ?? 0,
      outputTokens: usage.candidatesTokenCount ?? 0,
    };
  }
}

/* -------------------------------------------------------------------------- */
/* Choosing one                                                               */
/* -------------------------------------------------------------------------- */

/** The configured provider, or null when no key has been pasted in yet.
 *
 * Null rather than a throw is what lets the Command Center fall back to Demo
 * Mode instead of showing an error to somebody who has simply not finished
 * setting the system up. */
export async function getTextProvider(): Promise<TextProvider | null> {
  const { choice, key } = await readConfig();
  if (!key) return null;

  switch (choice.provider) {
    case "openai":
      return new OpenAiProvider(key, choice.model);
    case "google":
      return new GoogleProvider(key, choice.model);
    default:
      return new AnthropicProvider(key, choice.model);
  }
}
