import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertCircle, Archive, Eye, Info, Pencil, Plus, RotateCcw, Send, EyeOff } from "lucide-react";
import { getCurrentSeller } from "@/lib/sellers";
import { listAdminProducts } from "@/lib/adminData";
import { getSellerProductCounts, SELLER_PAGE_SIZE } from "@/lib/sellerCenter";
import { getShopSettings } from "@/lib/shopSettings";
import { formatPrice } from "@/lib/format";
import { resizedSrc } from "@/lib/image";
import FilterBar from "@/components/admin/FilterBar";
import {
  Card,
  EmptyState,
  PageHeader,
  Pagination,
  StatusPill,
  Thumb,
  buttonStyles,
} from "@/components/admin/ui";
import { Tabs, one } from "@/components/seller/ui";
import { setSellerProductStatusAction } from "./actions";

export const metadata = { title: "Products" };

/** What each tab shows, as the list query's filter. */
const TABS = [
  { key: "all", label: "All" },
  { key: "active", label: "Live" },
  { key: "pending_review", label: "In review" },
  { key: "draft", label: "Draft" },
  { key: "rejected", label: "Rejected" },
  { key: "low", label: "Low stock" },
  { key: "out", label: "Out of stock" },
  { key: "archived", label: "Archived" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

/** The seller's words for a status. "Active" is a database word; a shop owner
 * calls it live. */
const STATUS_LABEL: Record<string, string> = {
  active: "Live",
  pending_review: "In review",
  draft: "Draft",
  rejected: "Rejected",
  archived: "Archived",
};

export default async function SellerProductsPage(props: PageProps<"/seller/products">) {
  const seller = await getCurrentSeller();
  if (!seller) notFound();

  const searchParams = await props.searchParams;
  const tab = (TABS.find((entry) => entry.key === one(searchParams.tab))?.key ?? "all") as TabKey;
  const search = one(searchParams.search);
  const page = Math.max(1, Number(one(searchParams.page) ?? 1) || 1);

  const [products, counts, settings] = await Promise.all([
    listAdminProducts({
      sellerId: seller.id,
      search,
      page,
      pageSize: SELLER_PAGE_SIZE,
      status: tab === "all" || tab === "low" || tab === "out" ? undefined : tab,
      stock: tab === "low" || tab === "out" ? tab : undefined,
    }),
    getSellerProductCounts(seller.id),
    getShopSettings(),
  ]);

  const tabHref = (key: string) => {
    const query = new URLSearchParams();
    if (key !== "all") query.set("tab", key);
    if (search) query.set("search", search);
    const text = query.toString();
    return text ? `/seller/products?${text}` : "/seller/products";
  };

  return (
    <>
      <PageHeader
        title="Products"
        subtitle="Everything your store sells on Zupona"
        breadcrumb={["Products"]}
        action={
          <Link href="/seller/products/new" className={buttonStyles.primary}>
            <Plus className="h-4 w-4" />
            Add Product
          </Link>
        }
      />

      {settings.sellerProductsNeedReview ? (
        <p className="mb-4 flex items-start gap-2 rounded-xl border border-sky-100 bg-sky-50 px-3.5 py-2.5 text-[13px] text-sky-800">
          <Info className="mt-0.5 h-4 w-4 shrink-0" />
          New products are checked by Zupona before they go live. Edits to a product that is
          already live go live straight away.
        </p>
      ) : null}

      <Tabs
        current={tab}
        items={TABS.map((entry) => ({
          key: entry.key,
          label: entry.label,
          count: counts[entry.key],
          href: tabHref(entry.key),
          urgent: entry.key === "rejected" || entry.key === "out" || entry.key === "low",
        }))}
      />

      <Card padded={false} className="p-4 lg:p-5">
        <FilterBar base="/seller/products" searchPlaceholder="Search by name or SKU…" />

        {products.rows.length === 0 ? (
          counts.all === 0 && counts.archived === 0 ? (
            <EmptyState
              title="Your store has no products yet"
              detail="Add your first product with its photos, price and stock. It takes about five minutes."
              action={
                <Link href="/seller/products/new" className={buttonStyles.primary}>
                  <Plus className="h-4 w-4" />
                  Add your first product
                </Link>
              }
            />
          ) : (
            <EmptyState
              title="Nothing here"
              detail={search ? "No product matches that search." : "No products in this tab right now."}
              action={
                <Link href="/seller/products" className={buttonStyles.secondary}>
                  Show all products
                </Link>
              }
            />
          )
        ) : (
          <>
            <ul className="divide-y divide-neutral-100">
              {products.rows.map((row) => {
                const out = row.tracksStock && row.stock <= 0;
                return (
                  <li key={row.id} className="flex gap-3 py-3.5 first:pt-1">
                    <Link href={`/seller/products/${row.id}`} className="shrink-0">
                      <Thumb src={row.image ? resizedSrc(row.image, 128) : null} alt="" size={56} />
                    </Link>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
                        <Link
                          href={`/seller/products/${row.id}`}
                          className="line-clamp-2 min-w-0 flex-1 text-[14px] font-semibold text-neutral-800 hover:text-brand"
                        >
                          {row.name}
                        </Link>
                        <span className="shrink-0 text-[14px] font-bold text-neutral-900">
                          {formatPrice(row.price)}
                        </span>
                      </div>

                      <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[12px] text-neutral-500">
                        <StatusPill status={row.status} label={STATUS_LABEL[row.status]} />
                        <span
                          className={
                            out
                              ? "font-semibold text-red-600"
                              : row.isLowStock
                                ? "font-semibold text-amber-600"
                                : undefined
                          }
                        >
                          {row.tracksStock
                            ? out
                              ? "Out of stock"
                              : `${row.stock} in stock`
                            : "Unlimited stock"}
                        </span>
                        {row.categoryName ? <span>· {row.categoryName}</span> : null}
                      </div>

                      {row.status === "rejected" && row.rejectionReason ? (
                        <p className="mt-2 flex items-start gap-1.5 rounded-lg bg-red-50 px-2.5 py-2 text-[12px] text-red-700">
                          <AlertCircle className="mt-px h-3.5 w-3.5 shrink-0" />
                          <span>
                            <span className="font-semibold">Zupona&rsquo;s note: </span>
                            {row.rejectionReason} Fix it, then submit it again.
                          </span>
                        </p>
                      ) : null}

                      <div className="mt-2 flex flex-wrap items-center gap-1">
                        <Link href={`/seller/products/${row.id}`} className={buttonStyles.ghost}>
                          <Pencil className="h-3.5 w-3.5" />
                          Edit
                        </Link>
                        {row.status === "active" ? (
                          // Leaves the panel for the shop, so a plain anchor:
                          // prefetching it would fetch an RSC payload across
                          // origins for a page nobody asked for yet.
                          <a href={`/product/${row.id}`} target="_blank" rel="noreferrer" className={buttonStyles.ghost}>
                            <Eye className="h-3.5 w-3.5" />
                            View live
                          </a>
                        ) : null}
                        {row.status === "draft" || row.status === "rejected" ? (
                          <StatusButton productId={row.id} move="submit" icon="send">
                            {settings.sellerProductsNeedReview ? "Submit for review" : "Publish"}
                          </StatusButton>
                        ) : null}
                        {row.status === "active" ? (
                          <StatusButton productId={row.id} move="unpublish" icon="hide">
                            Unpublish
                          </StatusButton>
                        ) : null}
                        {row.status === "archived" ? (
                          <StatusButton productId={row.id} move="restore" icon="restore">
                            Restore
                          </StatusButton>
                        ) : (
                          <StatusButton productId={row.id} move="archive" icon="archive">
                            Archive
                          </StatusButton>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>

            <Pagination
              base="/seller/products"
              params={{ tab: tab === "all" ? undefined : tab, search }}
              page={page}
              total={products.total}
              pageSize={SELLER_PAGE_SIZE}
              noun="products"
            />
          </>
        )}
      </Card>
    </>
  );
}

const STATUS_ICONS = { send: Send, hide: EyeOff, restore: RotateCcw, archive: Archive };

function StatusButton({
  productId,
  move,
  icon,
  children,
}: {
  productId: string;
  move: string;
  icon: keyof typeof STATUS_ICONS;
  children: React.ReactNode;
}) {
  const Icon = STATUS_ICONS[icon];
  return (
    <form action={setSellerProductStatusAction}>
      <input type="hidden" name="productId" value={productId} />
      <input type="hidden" name="move" value={move} />
      <button
        type="submit"
        className={`${buttonStyles.ghost} ${move === "archive" ? "hover:!bg-red-50 hover:!text-red-600" : ""}`}
      >
        <Icon className="h-3.5 w-3.5" />
        {children}
      </button>
    </form>
  );
}
