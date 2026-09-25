import Link from "next/link";
import { Megaphone } from "lucide-react";
import { listCampaigns } from "@/lib/marketing/campaigns";
import { formatDateTime, formatPrice } from "@/lib/format";
import {
  Card,
  EmptyState,
  PageHeader,
  StatusPill,
  TableScroll,
  Td,
  Th,
  buttonStyles,
} from "@/components/admin/ui";

export const metadata = { title: "Campaigns" };

export default async function CampaignsPage() {
  const campaigns = await listCampaigns();

  return (
    <>
      <PageHeader
        title="Campaigns"
        subtitle="Every plan this shop has drafted, approved or run"
        breadcrumb={["Marketing", "Campaigns"]}
      />

      <Card>
        {campaigns.length === 0 ? (
          <EmptyState
            title="No campaigns yet"
            detail="Describe what you want to achieve in the Command Center and a plan will appear here."
            action={
              <Link href="/admin/marketing/ai" className={buttonStyles.primary}>
                <Megaphone className="h-4 w-4" />
                Open the Command Center
              </Link>
            }
          />
        ) : (
          <TableScroll>
            <table className="w-full min-w-[46rem] border-collapse">
              <thead>
                <tr>
                  <Th>Campaign</Th>
                  <Th>Product</Th>
                  <Th>Budget</Th>
                  <Th>Creatives</Th>
                  <Th>Status</Th>
                  <Th>Created</Th>
                </tr>
              </thead>
              <tbody>
                {campaigns.map((campaign) => (
                  <tr key={campaign.id} className="border-t border-neutral-100">
                    <Td>
                      <Link
                        href={`/admin/marketing/campaigns/${campaign.id}`}
                        className="font-semibold text-neutral-800 hover:text-brand"
                      >
                        {campaign.name}
                      </Link>
                      {campaign.isDemo ? (
                        <span className="ml-2 rounded-md bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold uppercase text-amber-700">
                          Demo
                        </span>
                      ) : null}
                    </Td>
                    <Td>{campaign.productName ?? "—"}</Td>
                    <Td>{formatPrice(campaign.budgetTotal)}</Td>
                    <Td>{campaign.creativeCount}</Td>
                    <Td>
                      <StatusPill status={campaign.status} />
                    </Td>
                    <Td>{formatDateTime(campaign.createdAt)}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableScroll>
        )}
      </Card>
    </>
  );
}
