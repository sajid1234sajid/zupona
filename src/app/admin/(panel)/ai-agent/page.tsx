import { CheckCircle2, ExternalLink, GitPullRequest, Hourglass, ScanSearch } from "lucide-react";
import { getCurrentUser } from "@/lib/session";
import { formatDateTime } from "@/lib/format";
import { getAgentOverview, type AgentFinding, type AgentStatus } from "@/lib/aiAgent";
import AgentDecisionForm from "@/components/admin/AgentDecisionForm";
import { Card, CardHeader, EmptyState, PageHeader, StatCard, StatusPill } from "@/components/admin/ui";

export const metadata = { title: "AI Agent" };

/** Each agent status drawn with the panel's existing pill colours. */
const STATUS_PILL: Record<AgentStatus, { status: string; label: string }> = {
  NEW: { status: "pending", label: "Needs your decision" },
  DISCUSS: { status: "processing", label: "To discuss" },
  WATCH: { status: "draft", label: "Watching" },
  APPROVED: { status: "confirmed", label: "Approved" },
  IMPLEMENTED: { status: "shipped", label: "Implemented" },
  VERIFIED: { status: "delivered", label: "Verified fixed" },
  REJECTED: { status: "rejected", label: "Rejected" },
};

const FIX_PILL: Record<NonNullable<AgentFinding["fix"]>["status"], { status: string; label: string }> = {
  queued: { status: "pending", label: "Waiting for the developer" },
  working: { status: "processing", label: "Developer at work" },
  pr_opened: { status: "shipped", label: "Pull request ready" },
  failed: { status: "failed", label: "Developer could not fix it" },
  cancelled: { status: "archived", label: "Fix cancelled" },
};

function FindingCard({ finding, decide }: { finding: AgentFinding; decide: boolean }) {
  const pill = STATUS_PILL[finding.status];
  const fix = finding.fix ? FIX_PILL[finding.fix.status] : null;
  const d = finding.detail;
  return (
    <div className="min-w-0 space-y-3 py-4 first:pt-0 last:pb-0">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold text-neutral-400">#{finding.id}</span>
        <StatusPill status={pill.status} label={pill.label} />
        {fix ? <StatusPill status={fix.status} label={fix.label} /> : null}
        <span className="ml-auto text-xs font-semibold text-neutral-500">
          {finding.priorityLabel} · score {finding.priorityScore}
        </span>
      </div>
      <p className="text-[15px] font-semibold text-neutral-800">{finding.title}</p>
      {d ? (
        <div className="space-y-2 text-sm text-neutral-600">
          <p>
            <span className="font-semibold text-neutral-700">Problem: </span>
            {d.problem}
          </p>
          <p>
            <span className="font-semibold text-neutral-700">Proposed fix: </span>
            {d.proposedSolution}
          </p>
          <p>
            <span className="font-semibold text-neutral-700">Impact: </span>
            {d.expectedImpact}
          </p>
          <p className="text-xs text-neutral-500">
            Risk {d.risk} · Difficulty {d.difficulty}
          </p>
          {d.evidence.length ? (
            <details className="text-xs text-neutral-500">
              <summary className="cursor-pointer font-semibold text-neutral-600">
                Evidence from the audit ({d.evidence.length})
              </summary>
              <ul className="mt-1.5 list-disc space-y-1 pl-5">
                {d.evidence.slice(0, 6).map((line, i) => (
                  <li key={i} className="break-words">
                    {line}
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
        </div>
      ) : null}
      {finding.fix?.prUrl ? (
        <a
          href={finding.fix.prUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand hover:underline"
        >
          <GitPullRequest className="h-4 w-4" />
          Review the pull request
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      ) : null}
      {finding.fix?.status === "failed" && finding.fix.message ? (
        <p className="text-xs text-red-600">{finding.fix.message}</p>
      ) : null}
      {decide ? <AgentDecisionForm id={finding.id} approved={finding.status === "APPROVED"} /> : null}
    </div>
  );
}

function Section({
  title,
  subtitle,
  findings,
  decide,
  empty,
}: {
  title: string;
  subtitle: string;
  findings: AgentFinding[];
  decide: boolean;
  empty: string;
}) {
  return (
    <Card>
      <CardHeader title={`${title} (${findings.length})`} subtitle={subtitle} />
      {findings.length === 0 ? (
        <EmptyState title={empty} />
      ) : (
        <div className="divide-y divide-neutral-100">
          {findings.map((finding) => (
            <FindingCard key={finding.id} finding={finding} decide={decide} />
          ))}
        </div>
      )}
    </Card>
  );
}

/** The AI agent's control room: what it found on the storefront, what the
 * developer agent is doing about the approved items, and what it has learned.
 * Decisions here are the same as the WhatsApp buttons. */
export default async function AiAgentPage() {
  const [user, result] = await Promise.all([getCurrentUser(), getAgentOverview()]);

  const header = (
    <PageHeader
      title="AI Agent"
      subtitle="Audits zupona.com every morning, recommends fixes, and opens pull requests for the ones you approve"
      breadcrumb={["AI Agent"]}
    />
  );

  if (user?.role !== "admin") {
    return (
      <>
        {header}
        <Card>
          <EmptyState title="Only the owner can use the AI agent" />
        </Card>
      </>
    );
  }

  if (!result.ok) {
    return (
      <>
        {header}
        <Card>
          <EmptyState title="The AI agent is not reachable" detail={result.problem} />
        </Card>
      </>
    );
  }

  const { findings, run, memory, pendingDecisions } = result.overview;
  const needsDecision = findings.filter((f) => ["NEW", "DISCUSS", "WATCH"].includes(f.status));
  const inProgress = findings.filter((f) => f.status === "APPROVED");
  const done = findings.filter((f) => ["IMPLEMENTED", "VERIFIED", "REJECTED"].includes(f.status));
  const queued = findings.filter((f) => f.fix && ["queued", "working"].includes(f.fix.status)).length;
  const toReview = findings.filter((f) => f.fix?.status === "pr_opened" && f.status === "APPROVED").length;
  const verified = findings.filter((f) => f.status === "VERIFIED").length;

  return (
    <>
      {header}

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        <StatCard label="Needs Your Decision" value={String(needsDecision.length)} icon={ScanSearch} tone="orange" />
        <StatCard label="Developer Queue" value={String(queued)} icon={Hourglass} tone="blue" />
        <StatCard label="Pull Requests to Review" value={String(toReview)} icon={GitPullRequest} tone="violet" />
        <StatCard label="Verified Fixed" value={String(verified)} icon={CheckCircle2} tone="green" />
      </div>

      <p className="mb-5 text-sm text-neutral-500">
        {run ? (
          <>
            Last audit {formatDateTime(run.finishedAt)} · {run.pagesCrawled} pages · {run.observations} checks flagged ·{" "}
            {run.newRecommendations} new
            {run.runUrl ? (
              <>
                {" · "}
                <a href={run.runUrl} target="_blank" rel="noreferrer" className="font-semibold text-brand hover:underline">
                  View the run
                </a>
              </>
            ) : null}
          </>
        ) : (
          "The next daily audit will fill in its details here."
        )}
        {pendingDecisions > 0
          ? ` · ${pendingDecisions} decision${pendingDecisions === 1 ? "" : "s"} will be recorded at the next run`
          : null}
      </p>

      <div className="grid gap-5 xl:grid-cols-12">
        <div className="min-w-0 space-y-5 xl:col-span-8">
          <Section
            title="Needs your decision"
            subtitle="Approve to get a pull request; reasons help it learn"
            findings={needsDecision}
            decide
            empty="Nothing is waiting for you"
          />
          <Section
            title="In progress"
            subtitle="One an hour; merged ones move to Done next audit"
            findings={inProgress}
            decide
            empty="No approved work in progress"
          />
          <Section
            title="Done"
            subtitle="Implemented, verified or rejected"
            findings={done}
            decide={false}
            empty="Nothing finished yet"
          />
        </div>

        <div className="min-w-0 space-y-5 xl:col-span-4">
          <Card>
            <CardHeader title="What the agent has learned" subtitle="Updated after every run" />
            {memory ? (
              <div className="space-y-4 text-sm text-neutral-600">
                {(
                  [
                    ["Your preferences", memory.ownerPreferences],
                    ["About the site", memory.siteFacts],
                    ["Lessons", memory.lessons],
                  ] as const
                ).map(([label, body]) => (
                  <div key={label}>
                    <p className="mb-1 text-[13px] font-semibold text-neutral-700">{label}</p>
                    <p className="whitespace-pre-wrap break-words text-[13px] leading-relaxed">{body}</p>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState title="Nothing yet" detail="The next daily audit sends its memory here." />
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
