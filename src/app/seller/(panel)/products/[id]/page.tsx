import { notFound } from "next/navigation";
import { AlertCircle, Clock, Eye } from "lucide-react";
import { listBrands } from "@/lib/catalog";
import { getProductForEdit, listCategoryOptions } from "@/lib/adminData";
import { getCurrentSeller } from "@/lib/sellers";
import { getShopSettings } from "@/lib/shopSettings";
import { getAutoFitMode } from "@/lib/imageFit";
import { statusesFor } from "@/lib/productSave";
import { formatDateTime } from "@/lib/format";
import ProductForm from "@/components/admin/ProductForm";
import { cellsFromVariants, groupsFromProduct } from "@/components/admin/optionBuilder";
import { PageHeader, buttonStyles } from "@/components/admin/ui";
import { publishOptionsFor, sellerAutoFit } from "@/components/seller/productFormOptions";
import { updateSellerProductAction } from "../actions";

export const metadata = { title: "Edit Product" };

export default async function SellerEditProductPage(props: PageProps<"/seller/products/[id]">) {
  const { id } = await props.params;
  const searchParams = await props.searchParams;

  const [seller, product, categories, brands, autoFit, settings] = await Promise.all([
    getCurrentSeller(),
    getProductForEdit(id),
    listCategoryOptions(),
    listBrands(),
    getAutoFitMode(),
    getShopSettings(),
  ]);

  // Another store's product is "not found" rather than "forbidden": saying it
  // exists would confirm a guessed id. The save re-checks ownership itself.
  if (!seller || !product || product.sellerId !== seller.id) notFound();

  const owner = {
    kind: "seller" as const,
    sellerId: seller.id,
    needsReview: settings.sellerProductsNeedReview,
  };

  const totalStock = product.variants
    .filter((variant) => variant.isActive)
    .reduce((sum, variant) => sum + variant.stockQuantity, 0);

  return (
    <>
      <PageHeader
        title={product.name}
        subtitle={`Added ${formatDateTime(product.createdAt)}`}
        breadcrumb={["Products", "Edit Product"]}
        action={
          product.status === "active" ? (
            <a
              href={`/product/${product.id}`}
              target="_blank"
              rel="noreferrer"
              className={buttonStyles.secondary}
            >
              <Eye className="h-4 w-4" />
              View live
            </a>
          ) : null
        }
      />

      {searchParams.saved ? (
        <p className="mb-4 rounded-xl bg-emerald-50 px-3.5 py-2.5 text-sm text-emerald-700">
          {product.status === "pending_review"
            ? "Product saved and sent to Zupona for review. It goes live once it is approved."
            : "Product saved."}
        </p>
      ) : null}

      {product.status === "rejected" ? (
        <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-semibold">Zupona sent this product back</p>
            <p className="mt-0.5">{product.rejectionReason ?? "No reason was given."}</p>
            <p className="mt-1 text-[12px] text-red-600">
              Fix what is described, choose &ldquo;Submit for review&rdquo; and save.
            </p>
          </div>
        </div>
      ) : product.status === "pending_review" ? (
        <p className="mb-4 flex items-center gap-2 rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <Clock className="h-4 w-4 shrink-0" />
          Waiting for Zupona&rsquo;s review. You can still edit it meanwhile.
        </p>
      ) : null}

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: "Units sold", value: product.soldCount.toLocaleString("en-US") },
          { label: "Page views", value: product.viewCount.toLocaleString("en-US") },
          {
            label: "Stock on hand",
            value: product.trackInventory ? totalStock.toLocaleString("en-US") : "Unlimited",
          },
          {
            label: "Rating",
            value: product.ratingCount
              ? `${product.ratingAvg} (${product.ratingCount})`
              : "No reviews",
          },
        ].map((stat) => (
          <div
            key={stat.label}
            className="rounded-2xl border border-black/[0.05] bg-white p-4 shadow-[0_1px_2px_rgba(16,24,40,0.04)]"
          >
            <p className="text-xs text-neutral-400">{stat.label}</p>
            <p className="mt-0.5 truncate text-lg font-bold text-neutral-900">{stat.value}</p>
          </div>
        ))}
      </div>

      <ProductForm
        mode="edit"
        action={updateSellerProductAction}
        autoFit={sellerAutoFit(autoFit)}
        cancelHref="/seller/products"
        publishOptions={publishOptionsFor(statusesFor(owner, product.status))}
        showMerchandising={false}
        categories={categories.map((option) => ({ id: option.id, label: option.label }))}
        brands={brands.map((brand) => ({ id: brand.id, label: brand.name }))}
        showStockFields={false}
        values={{
          id: product.id,
          name: product.name,
          sku: product.sku ?? "",
          description: product.description ?? "",
          categoryId: product.categoryId ?? "",
          brandId: product.brandId ?? "",
          price: product.basePrice,
          discountType: product.discountType,
          discountValue: product.discountValue,
          stock: totalStock,
          lowStockAlert: product.variants[0]?.lowStockThreshold ?? 5,
          trackInventory: product.trackInventory,
          freeDelivery: product.freeDelivery,
          colors: product.colors,
          sizes: product.sizes,
          optionGroups: groupsFromProduct(product.optionGroups),
          variantCells: cellsFromVariants(product.variants, product.optionGroups),
          tags: product.tags,
          images: product.images,
          videos: product.videos,
          videoPosters: product.videoPosters,
          weight: product.weightKg,
          length: product.length,
          width: product.width,
          height: product.height,
          metaTitle: product.metaTitle,
          metaDescription: product.metaDescription,
          status: product.status,
          isFeatured: product.isFeatured,
          isBestSeller: product.isBestSeller,
          updatedAt: product.updatedAt,
        }}
      />
    </>
  );
}
