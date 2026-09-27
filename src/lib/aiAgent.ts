/** The Zupona AI agent, as the admin panel sees it.
 *
 * The agent is a separate system (github.com/sajid123sajid/zupona-ai-agent):
 * it audits the storefront every morning, read-only, has Claude recommend
 * fixes, and opens pull requests for the ones the owner approves. It never
 * touches this Worker's database. Its always-on half, the relay, keeps the
 * recommendations and takes decisions -- from WhatsApp, and from this panel.
 *
 * This module is the only door to it. It talks to the relay server-side with
 * AGENT_ADMIN_TOKEN, which can read the recommendations and record a decision
 * and nothing else; the token never reaches the browser. */

export type AgentStatus = "NEW" | "APPROVED" | "REJECTED" | "DISCUSS" | "WATCH" | "IMPLEMENTED" | "VERIFIED";
export type AgentAction = "approve" | "reject" | "discuss" | "watch";

export interface AgentFinding {
  id: number;
  title: string;
  status: AgentStatus;
  priorityLabel: string;
  priorityScore: number;
  detail?: {
    problem: string;
    proposedSolution: string;
    expectedImpact: string;
    risk: string;
    difficulty: string;
    /** From the deterministic audit, never from the model. */
    evidence: string[];
    urls: string[];
  };
  /** The developer agent's progress on an approved recommendation. */
  fix: {
    status: "queued" | "working" | "pr_opened" | "failed" | "cancelled";
    prUrl: string | null;
    message: string | null;
    updatedAt: string;
  } | null;
}

export interface AgentOverview {
  snapshotAt: string | null;
  findings: AgentFinding[];
  /** Decisions the agent has not collected yet (it does so at its next daily run). */
  pendingDecisions: number;
  memory: { ownerPreferences: string; siteFacts: string; lessons: string } | null;
  run: {
    finishedAt: string;
    pagesCrawled: number;
    observations: number;
    newRecommendations: number;
    runUrl: string | null;
  } | null;
}

async function readEnv(): Promise<Record<string, unknown> | undefined> {
  try {
    const { env } = await import("cloudflare:workers");
    return env as unknown as Record<string, unknown>;
  } catch {
    // Outside the Workers runtime there is no relay to reach, which reads the
    // same as an unconfigured agent.
    return undefined;
  }
}

function text(value: unknown): string | null {
  const trimmed = typeof value === "string" ? value.trim() : "";
  return trimmed.length > 0 ? trimmed : null;
}

async function relay(path: string, init: RequestInit = {}): Promise<Response> {
  const env = await readEnv();
  const base = text(env?.AGENT_RELAY_URL);
  const token = text(env?.AGENT_ADMIN_TOKEN);
  if (!base || !token) {
    throw new AgentUnavailableError("AGENT_RELAY_URL and AGENT_ADMIN_TOKEN are not set on the Worker.");
  }
  try {
    return await fetch(`${base.replace(/\/+$/, "")}${path}`, {
      ...init,
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json", ...init.headers },
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    throw new AgentUnavailableError("The AI agent did not answer. Try again in a minute.");
  }
}

export class AgentUnavailableError extends Error {}

export async function getAgentOverview(): Promise<{ ok: true; overview: AgentOverview } | { ok: false; problem: string }> {
  try {
    const res = await relay("/admin/overview");
    if (!res.ok) return { ok: false, problem: `The AI agent answered ${res.status}.` };
    return { ok: true, overview: (await res.json()) as AgentOverview };
  } catch (error) {
    if (error instanceof AgentUnavailableError) return { ok: false, problem: error.message };
    throw error;
  }
}

/** Records the owner's decision, exactly as the WhatsApp buttons do: approving
 * queues the developer agent, and the agent records the decision (with its
 * reason, which it learns from) at its next daily run. */
export async function decideAgentRecommendation(
  recommendationId: number,
  action: AgentAction,
  note: string | null
): Promise<{ ok: boolean; message: string; status: AgentStatus | null; fixQueued: boolean }> {
  const res = await relay("/admin/decide", {
    method: "POST",
    body: JSON.stringify({ recommendationId, action, note }),
  });
  const body = (await res.json().catch(() => null)) as {
    message?: string;
    status?: AgentStatus | null;
    fixQueued?: boolean;
    error?: string;
  } | null;
  // The relay writes its messages for WhatsApp, where *text* is bold.
  const message = (body?.message ?? body?.error ?? `The AI agent answered ${res.status}.`).replace(/\*/g, "");
  return { ok: res.ok, message, status: body?.status ?? null, fixQueued: body?.fixQueued ?? false };
}
