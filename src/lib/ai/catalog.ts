/** The list of AI vendors, and nothing else.
 *
 * Split out from `provider.ts` because the settings form has to draw this
 * list, and the settings form runs in a browser. `provider.ts` imports the
 * Anthropic SDK and reaches for the database; importing it from a client
 * component would drag both into the browser bundle and put the code that
 * reads API keys one bad refactor away from shipping to a shopper.
 *
 * Everything here is safe to send to a browser: names, hints, and which
 * setting holds which key -- never a key itself. */

export type ProviderName = "anthropic" | "openai" | "google";

export interface ProviderMeta {
  label: string;
  /** The `site_settings` row that holds this vendor's key. */
  settingKey: string;
  /** What runs when the shop has not named a model. */
  defaultModel: string;
  /** Where to get a key, in one line. */
  keyHint: string;
}

export const PROVIDERS: Record<ProviderName, ProviderMeta> = {
  anthropic: {
    label: "Anthropic (Claude)",
    settingKey: "anthropic_api_key",
    defaultModel: "claude-opus-5",
    keyHint: "console.anthropic.com → API keys. Starts with sk-ant-",
  },
  openai: {
    label: "OpenAI (GPT)",
    settingKey: "openai_api_key",
    defaultModel: "gpt-4o",
    keyHint: "platform.openai.com → API keys. Starts with sk-",
  },
  google: {
    label: "Google (Gemini)",
    settingKey: "google_api_key",
    defaultModel: "gemini-1.5-pro",
    keyHint: "aistudio.google.com → Get API key",
  },
};

/** Which vendor is selected, which model, and whether it can actually run.
 * Carries no key -- `hasKey` is the whole of what a browser may know. */
export interface ProviderChoice {
  provider: ProviderName;
  model: string;
  hasKey: boolean;
}

export function isProviderName(value: string | undefined): value is ProviderName {
  return value === "anthropic" || value === "openai" || value === "google";
}
