import { notFound } from "next/navigation";
import { getCurrentSeller } from "@/lib/sellers";
import { Card, CardHeader, PageHeader } from "@/components/admin/ui";
import StoreForm from "@/components/seller/StoreForm";

export const metadata = { title: "Store" };

export default async function SellerStorePage() {
  const seller = await getCurrentSeller();
  if (!seller) notFound();

  return (
    <>
      <PageHeader
        title="Store"
        subtitle="How your shop introduces itself to shoppers"
        breadcrumb={["Store"]}
      />

      <div className="grid gap-5 xl:grid-cols-12">
        <div className="min-w-0 xl:col-span-7">
          <Card>
            <CardHeader title="Store details" subtitle="Saved changes go live immediately" />
            <StoreForm storeName={seller.storeName} description={seller.description ?? ""} />
          </Card>
        </div>

        <div className="min-w-0 xl:col-span-5">
          <Card>
            <CardHeader
              title="Set by Zupona"
              subtitle="Ask support if any of these need to change"
            />
            <dl className="divide-y divide-neutral-100 text-sm">
              <div className="flex items-center justify-between gap-3 py-2.5">
                <dt className="text-neutral-500">Store URL</dt>
                <dd className="min-w-0 truncate font-mono text-[13px] text-neutral-600">
                  /{seller.slug}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3 py-2.5">
                <dt className="text-neutral-500">Commission rate</dt>
                <dd className="font-medium text-neutral-800">{seller.commissionRate}%</dd>
              </div>
            </dl>
            <p className="mt-3 rounded-xl bg-neutral-50 px-3.5 py-2.5 text-[11px] leading-relaxed text-neutral-500">
              Your store URL is fixed once your shop is approved. Changing it would break every
              link and every share of your products that already exists.
            </p>
          </Card>
        </div>
      </div>
    </>
  );
}
