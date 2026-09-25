import { notFound } from "next/navigation";
import Link from "next/link";
import { Film, Image as ImageIcon, LayoutGrid, Link2 } from "lucide-react";
import { getCampaignView } from "@/lib/marketing/campaigns";
import { formatDateTime, formatPrice } from "@/lib/format";
import ApprovalPanel from "@/components/admin/marketing/ApprovalPanel";
import { Card, CardHeader, PageHeader, StatusPill, buttonStyles } from "@/components/admin/ui";

export const metadata = { title: "Campaign" };

const FORMAT_ICONS = { image: ImageIcon, video: Film, carousel: LayoutGrid } as const;

/** Whole days between the two ends of the run, for the approval summary. */
function durationDays(startsAt: string | null, endsAt: string | null): number | null {
  if (!startsAt || !endsAt) return null;
  const start = Date.parse(startsAt.replace(" ", "T") + "Z");
  const end = Date.parse(endsAt.replace(" ", "T") + "Z");
  if (Number.isNaN(start) || Number.isNaN(end)) return null;
  return Math.max(1, Math.round((end - start) / 86_400_000));
}

export default async function CampaignPage({
  params,
}: PageProps<"/admin/marketing/campaigns/[id]">) {
  const { id } = await params;
  const campaign = await getCampaignView(id);

  if (!campaign) notFound();

  const days = durationDays(campaign.startsAt, campaign.endsAt);
  const decidable = campaign.status === "awaiting_approval" || campaign.status === "draft";

  return (
    <>
      <PageHeader
        title={campaign.name}
        subtitle={campaign.productName ?? "No product attached"}
        breadcrumb={["Marketing", "Campaigns", campaign.name]}
      />

      {campaign.isDemo ? (
        <p className="mb-4 rounded-xl border border-amber-300 bg-amber-50 px-3.5 py-2.5 text-[12.5px] text-amber-900">
          <strong className="font-semibold">Demo data.</strong> This campaign was written without
          an AI provider configured. It is kept out of every reported figure.
        </p>
      ) : null}

      {campaign.externalError ? (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-3.5 py-3">
          <p className="text-[13px] font-semibold text-red-800">Publishing failed</p>
          <p className="mt-0.5 text-[12px] text-red-700">{campaign.externalError}</p>
        </div>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-12">
        <div className="min-w-0 space-y-4 xl:col-span-7">
          <Card>
            <CardHeader title="The plan" />
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-[12.5px] sm:grid-cols-3">
              <div>
                <dt className="text-neutral-400">Status</dt>
                <dd className="mt-1">
                  <StatusPill status={campaign.status} />
                </dd>
              </div>
              <div>
                <dt className="text-neutral-400">Budget</dt>
                <dd className="mt-1 font-semibold text-neutral-800">
                  {formatPrice(campaign.budgetTotal)}
                </dd>
              </div>
              <div>
                <dt className="text-neutral-400">Per day</dt>
                <dd className="mt-1 text-neutral-700">
                  {campaign.budgetDaily === null ? "—" : formatPrice(campaign.budgetDaily)}
                </dd>
              </div>
              <div>
                <dt className="text-neutral-400">Objective</dt>
                <dd className="mt-1 text-neutral-700 capitalize">{campaign.objective}</dd>
              </div>
              <div>
                <dt className="text-neutral-400">Platform</dt>
                <dd className="mt-1 text-neutral-700 capitalize">{campaign.platform}</dd>
              </div>
              <div>
                <dt className="text-neutral-400">Runs</dt>
                <dd className="mt-1 text-neutral-700">{days ? `${days} days` : "—"}</dd>
              </div>
            </dl>

            {campaign.audienceHypothesis ? (
              <div className="mt-3.5 border-t border-neutral-100 pt-3.5">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">
                  Audience hypothesis
                </p>
                <p className="mt-1 text-[12.5px] text-neutral-600">
                  {campaign.audienceHypothesis}
                </p>
              </div>
            ) : null}

            {campaign.utmCampaign ? (
              <p className="mt-3 flex items-center gap-1.5 text-[11px] text-neutral-400">
                <Link2 className="h-3.5 w-3.5" />
                utm_campaign={campaign.utmCampaign}
              </p>
            ) : null}
          </Card>

          <Card>
            <CardHeader
              title={`Creatives (${campaign.creatives.length})`}
              subtitle="Each one tests a different reason to buy"
            />
            <ul className="space-y-3">
              {campaign.creatives.map((creative) => {
                const Icon =
                  FORMAT_ICONS[creative.format as keyof typeof FORMAT_ICONS] ?? ImageIcon;
                return (
                  <li key={creative.id} className="rounded-xl border border-neutral-100 p-3.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="flex items-center gap-2 text-[13px] font-bold text-neutral-800">
                        <Icon className="h-4 w-4 text-neutral-400" />
                        {creative.label}
                        <span className="rounded-md bg-neutral-100 px-1.5 py-0.5 text-[10px] font-medium text-neutral-500">
                          {creative.angle}
                        </span>
                      </p>
                      <StatusPill status={creative.status} />
                    </div>

                    <p className="mt-2 text-[13px] font-medium text-neutral-800">
                      “{creative.hook}”
                    </p>

                    {creative.headline ? (
                      <p className="mt-1.5 text-[12px] text-neutral-600">
                        <span className="text-neutral-400">Headline: </span>
                        {creative.headline}
                      </p>
                    ) : null}
                    {creative.body ? (
                      <p className="mt-1 text-[12px] text-neutral-600">{creative.body}</p>
                    ) : null}
                    {creative.script ? (
                      <pre className="mt-2 whitespace-pre-wrap rounded-lg bg-neutral-50 p-2.5 font-sans text-[11.5px] leading-relaxed text-neutral-600">
                        {creative.script}
                      </pre>
                    ) : null}
                    {creative.visualDirection ? (
                      <p className="mt-1.5 text-[11.5px] text-neutral-500">
                        <span className="text-neutral-400">Visual: </span>
                        {creative.visualDirection}
                      </p>
                    ) : null}

                    <p className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-neutral-400">
                      {creative.cta ? <span>CTA: {creative.cta}</span> : null}
                      {creative.utmContent ? (
                        <span>utm_content={creative.utmContent}</span>
                      ) : null}
                    </p>
                  </li>
                );
              })}
            </ul>
          </Card>
        </div>

        <div className="min-w-0 space-y-4 xl:col-span-5">
          <Card>
            <CardHeader title="Approval" />
            {decidable ? (
              <ApprovalPanel
                campaignId={campaign.id}
                budgetTotal={campaign.budgetTotal}
                creativeCount={campaign.creatives.length}
                days={days}
                isDemo={campaign.isDemo}
              />
            ) : campaign.decision ? (
              <div className="rounded-xl border border-neutral-100 bg-neutral-50/60 p-3.5">
                <p className="text-[13px] font-semibold text-neutral-800 capitalize">
                  {campaign.decision.decision}
                </p>
                <p className="mt-1 text-[12px] text-neutral-500">
                  {formatDateTime(campaign.decision.decidedAt)} · approved at{" "}
                  {formatPrice(campaign.decision.budgetSnapshot)}
                </p>
              </div>
            ) : (
              <p className="py-6 text-center text-[13px] text-neutral-400">
                This campaign is {campaign.status.replace(/_/g, " ")}.
              </p>
            )}
          </Card>

          <Card>
            <CardHeader title="Next" />
            <p className="text-[12.5px] text-neutral-500">
              Publishing to Meta is not wired up yet. Once an ad account is connected, an approved
              campaign will be created there and verified before it is marked as live.
            </p>
            <Link
              href="/admin/marketing/ai"
              className={`${buttonStyles.secondary} mt-3 w-full justify-center`}
            >
              Back to the Command Center
            </Link>
          </Card>
        </div>
      </div>
    </>
  );
}
