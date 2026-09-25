import Link from "next/link";
import {
  ChevronRight,
  Eye,
  EyeOff,
  Image as ImageIcon,
  Plus,
  Power,
  Sparkles,
  Trash2,
  Zap,
} from "lucide-react";
import { listBanners, listFlashSales, listProductOptions } from "@/lib/adminData";
import { formatDateTime, formatPrice } from "@/lib/format";
import { BannerForm, BroadcastForm, FlashSaleForm } from "@/components/admin/MarketingForms";
import {
  Card,
  CardHeader,
  PageHeader,
  StatusPill,
  Thumb,
  buttonStyles,
  fieldStyles,
} from "@/components/admin/ui";
import {
  addFlashSaleItemAction,
  deleteBannerAction,
  toggleBannerAction,
  toggleFlashSaleAction,
} from "./actions";

export const metadata = { title: "Marketing" };

const PLACEMENT_LABELS: Record<string, string> = {
  hero: "Hero",
  promo: "Promo strip",
  discover: "Discover row",
};

export default async function MarketingPage() {
  const [banners, sales, products] = await Promise.all([
    listBanners(),
    listFlashSales(),
    listProductOptions(),
  ]);

  return (
    <>
      <PageHeader
        title="Marketing"
        subtitle="Banners, flash sales and customer announcements"
        breadcrumb={["Marketing"]}
      />

      {/* This page is the shop's own merchandising; advertising lives next
          door. The two were easy to confuse once the Command Center existed,
          because this is still what /marketing opens on -- so the door is
          drawn here rather than left to the sidebar to explain. */}
      <Link
        href="/admin/marketing/ai"
        className="mb-5 flex items-center gap-3.5 rounded-2xl border border-brand/30 bg-brand-tint/40 px-4 py-3.5 transition hover:border-brand/60 hover:bg-brand-tint/60"
      >
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white shadow-sm">
          <Sparkles className="h-5 w-5 text-brand" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[13.5px] font-bold text-neutral-800">
            AI Command Center
          </span>
          <span className="block text-[12px] text-neutral-500">
            Say what you want to achieve and get back a campaign plan — research, advert
            concepts and a budget, waiting for your approval
          </span>
        </span>
        <ChevronRight className="h-5 w-5 shrink-0 text-brand" />
      </Link>

      <div className="grid gap-5 xl:grid-cols-12">
        <div className="min-w-0 space-y-4 xl:col-span-8">
          <Card>
            <CardHeader
              title="Homepage Banners"
              subtitle="Editable without a deploy — changes go live immediately"
            />
            {banners.length === 0 ? (
              <p className="flex items-center justify-center gap-2 py-10 text-sm text-neutral-400">
                <ImageIcon className="h-4 w-4" />
                No banners yet. Create one on the right.
              </p>
            ) : (
              <ul className="space-y-2.5">
                {banners.map((banner) => (
                  <li
                    key={banner.id}
                    className={`flex items-center gap-3 rounded-xl border border-neutral-100 p-2.5 ${
                      banner.isActive ? "" : "opacity-60"
                    }`}
                  >
                    <span className="h-14 w-24 shrink-0 overflow-hidden rounded-lg border border-neutral-100 bg-neutral-50">
                      {banner.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={banner.imageUrl} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <span className="flex h-full w-full items-center justify-center text-[10px] text-neutral-300">
                          No image
                        </span>
                      )}
                    </span>

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-semibold text-neutral-800">
                        {banner.title}
                      </p>
                      {banner.subtitle ? (
                        <p className="truncate text-[11px] text-neutral-400">{banner.subtitle}</p>
                      ) : null}
                      <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[10px] text-neutral-400">
                        <span className="rounded-md bg-neutral-100 px-1.5 py-0.5">
                          {PLACEMENT_LABELS[banner.placement] ?? banner.placement}
                        </span>
                        {banner.linkUrl ? <span>→ {banner.linkUrl}</span> : null}
                        {banner.isActive ? null : <span>· Hidden</span>}
                      </p>
                    </div>

                    <div className="flex shrink-0 items-center gap-0.5">
                      <form action={toggleBannerAction}>
                        <input type="hidden" name="bannerId" value={banner.id} />
                        <button
                          type="submit"
                          title={banner.isActive ? "Hide" : "Show"}
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-700"
                        >
                          {banner.isActive ? (
                            <Eye className="h-4 w-4" />
                          ) : (
                            <EyeOff className="h-4 w-4" />
                          )}
                        </button>
                      </form>
                      <form action={deleteBannerAction}>
                        <input type="hidden" name="bannerId" value={banner.id} />
                        <button
                          type="submit"
                          title="Delete"
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-neutral-400 transition hover:bg-red-50 hover:text-red-600"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </form>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <CardHeader title="Flash Sales" subtitle="Time-boxed price drops" />
            {sales.length === 0 ? (
              <p className="flex items-center justify-center gap-2 py-10 text-sm text-neutral-400">
                <Zap className="h-4 w-4" />
                No flash sales scheduled.
              </p>
            ) : (
              <ul className="space-y-4">
                {sales.map((sale) => (
                  <li key={sale.id} className="rounded-xl border border-neutral-100 p-3.5">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-[13px] font-bold text-neutral-800">
                          {sale.name}
                        </p>
                        <p className="text-[11px] text-neutral-400">
                          {formatDateTime(sale.startsAt)} → {formatDateTime(sale.endsAt)}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <StatusPill
                          status={sale.isActive ? "active" : "draft"}
                          label={sale.isActive ? "Running" : "Paused"}
                        />
                        <form action={toggleFlashSaleAction}>
                          <input type="hidden" name="saleId" value={sale.id} />
                          <button
                            type="submit"
                            title={sale.isActive ? "Pause this sale" : "Start this sale"}
                            className="flex h-8 w-8 items-center justify-center rounded-lg text-neutral-400 transition hover:bg-neutral-100 hover:text-brand"
                          >
                            <Power className="h-4 w-4" />
                          </button>
                        </form>
                      </div>
                    </div>

                    {sale.items.length > 0 ? (
                      <ul className="mt-3 space-y-2 border-t border-neutral-100 pt-3">
                        {sale.items.map((item) => (
                          <li key={item.id} className="flex items-center gap-2.5">
                            <Thumb src={item.productImage} alt="" size={32} />
                            <span className="min-w-0 flex-1 truncate text-[12px] text-neutral-700">
                              {item.productName}
                            </span>
                            <span className="shrink-0 whitespace-nowrap text-[12px]">
                              <span className="font-semibold text-brand">
                                {formatPrice(item.salePrice)}
                              </span>
                              <span className="ml-1.5 text-neutral-400 line-through">
                                {formatPrice(item.normalPrice)}
                              </span>
                            </span>
                            <span className="shrink-0 text-[11px] text-neutral-400">
                              {item.soldCount}
                              {item.stockLimit ? `/${item.stockLimit}` : ""} sold
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : null}

                    <form
                      action={addFlashSaleItemAction}
                      className="mt-3 flex flex-wrap items-end gap-2 border-t border-neutral-100 pt-3"
                    >
                      <input type="hidden" name="saleId" value={sale.id} />
                      <label className="min-w-[10rem] flex-[2]">
                        <span className="mb-1 block text-[11px] font-medium text-neutral-500">
                          Product
                        </span>
                        <select name="productId" required className={fieldStyles}>
                          <option value="">Choose a product</option>
                          {products.map((product) => (
                            <option key={product.id} value={product.id}>
                              {product.name} — {formatPrice(product.price)}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="min-w-[7rem] flex-1">
                        <span className="mb-1 block text-[11px] font-medium text-neutral-500">
                          Sale price
                        </span>
                        <input
                          name="salePrice"
                          type="number"
                          min={1}
                          required
                          placeholder="Must be lower"
                          className={fieldStyles}
                        />
                      </label>
                      <label className="min-w-[6rem] flex-1">
                        <span className="mb-1 block text-[11px] font-medium text-neutral-500">
                          Units
                        </span>
                        <input
                          name="stockLimit"
                          type="number"
                          min={0}
                          placeholder="All"
                          className={fieldStyles}
                        />
                      </label>
                      <button type="submit" className={buttonStyles.secondary}>
                        <Plus className="h-4 w-4" />
                        Add
                      </button>
                    </form>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="min-w-0 space-y-4 xl:col-span-4">
          <BannerForm />
          <FlashSaleForm />
          <BroadcastForm />
        </div>
      </div>
    </>
  );
}
