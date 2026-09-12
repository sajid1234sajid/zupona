import Link from "next/link";
import { notFound } from "next/navigation";
import { Eye, Package, Plus, Star, Trash2 } from "lucide-react";
import { listBrands } from "@/lib/catalog";
import { getProductForEdit } from "@/lib/adminData";
import { formatDateTime, formatPrice } from "@/lib/format";
import { listCategoryOptions } from "@/lib/adminData";
import ProductForm from "@/components/admin/ProductForm";
import {
  Card,
  CardHeader,
  PageHeader,
  StatusPill,
  Td,
  Th,
  TableScroll,
  buttonStyles,
  fieldStyles,
} from "@/components/admin/ui";
import {
  addVariantAction,
  deleteVariantAction,
  setVariantStockAction,
  updateProductAction,
} from "../actions";

export async function generateMetadata(props: PageProps<"/admin/products/[id]">) {
  const { id } = await props.params;
  const product = await getProductForEdit(id);
  return { title: product ? `Edit ${product.name}` : "Product" };
}

export default async function EditProductPage(props: PageProps<"/admin/products/[id]">) {
  const { id } = await props.params;
  const searchParams = await props.searchParams;

  const [product, categories, brands] = await Promise.all([
    getProductForEdit(id),
    listCategoryOptions(),
    listBrands(),
  ]);

  if (!product) notFound();

  const totalStock = product.variants.reduce((sum, variant) => sum + variant.stockQuantity, 0);

  return (
    <>
      <PageHeader
        title={product.name}
        subtitle={`Created ${formatDateTime(product.createdAt)}`}
        breadcrumb={["Products", "Edit Product"]}
        action={
          <a href={`/product/${product.id}`} className={buttonStyles.secondary}>
            <Eye className="h-4 w-4" />
            View live
          </a>
        }
      />

      {searchParams.saved ? (
        <p className="mb-4 rounded-xl bg-emerald-50 px-3.5 py-2.5 text-sm text-emerald-700">
          Product created. You can add colour and size variants below.
        </p>
      ) : null}

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: "Units sold", value: product.soldCount.toLocaleString("en-US") },
          { label: "Page views", value: product.viewCount.toLocaleString("en-US") },
          { label: "Stock on hand", value: totalStock.toLocaleString("en-US") },
          {
            label: "Rating",
            value: product.ratingCount ? `${product.ratingAvg} (${product.ratingCount})` : "No reviews",
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
        action={updateProductAction}
        categories={categories.map((option) => ({ id: option.id, label: option.label }))}
        brands={brands.map((brand) => ({ id: brand.id, label: brand.name }))}
        showStockFields={false}
        values={{
          id: product.id,
          name: product.name,
          sku: product.sku ?? "",
          description: product.description ?? "",
          categoryId: product.categoryId ?? "",
          extraCategoryIds: product.extraCategoryIds,
          brandId: product.brandId ?? "",
          price: product.basePrice,
          discountType: product.discountType,
          discountValue: product.discountValue,
          stock: totalStock,
          lowStockAlert: product.variants[0]?.lowStockThreshold ?? 5,
          colors: product.colors,
          sizes: product.sizes,
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
        }}
      />

      <Card className="mt-5">
        <CardHeader
          title="Variants & Stock"
          subtitle="Stock lives on variants — every product has at least one"
        />

        <TableScroll>
          <table className="w-full min-w-[720px] border-collapse">
            <thead>
              <tr className="border-b border-neutral-100">
                <Th className="pl-4 lg:pl-3">Option</Th>
                <Th>SKU</Th>
                <Th className="text-right">Price</Th>
                <Th className="text-right">Reserved</Th>
                <Th className="text-right">In stock</Th>
                <Th>Status</Th>
                <Th className="pr-4 text-right lg:pr-3">Remove</Th>
              </tr>
            </thead>
            <tbody>
              {product.variants.map((variant) => {
                const available = Math.max(0, variant.stockQuantity - variant.reservedQuantity);
                const label =
                  [variant.optionValue, variant.option2Value].filter(Boolean).join(" · ") ||
                  "Default";

                return (
                  <tr key={variant.id} className="border-b border-neutral-50 last:border-0">
                    <Td className="pl-4 font-medium lg:pl-3">{label}</Td>
                    <Td className="text-neutral-500">{variant.sku ?? "—"}</Td>
                    <Td className="whitespace-nowrap text-right">
                      {variant.price === null ? (
                        <span className="text-neutral-400">Product price</span>
                      ) : (
                        formatPrice(variant.price)
                      )}
                    </Td>
                    <Td className="text-right text-neutral-500">{variant.reservedQuantity}</Td>
                    <Td>
                      <form
                        action={setVariantStockAction}
                        className="flex items-center justify-end gap-1.5"
                      >
                        <input type="hidden" name="variantId" value={variant.id} />
                        <input type="hidden" name="productId" value={product.id} />
                        <input
                          name="quantity"
                          type="number"
                          min={0}
                          defaultValue={variant.stockQuantity}
                          aria-label={`Stock for ${label}`}
                          className="h-9 w-20 rounded-lg border border-neutral-200 px-2 text-right text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/15"
                        />
                        <button
                          type="submit"
                          className="rounded-lg border border-neutral-200 px-2.5 py-1.5 text-[11px] font-semibold text-neutral-600 transition hover:border-brand hover:text-brand"
                        >
                          Set
                        </button>
                      </form>
                    </Td>
                    <Td>
                      <StatusPill
                        status={
                          available === 0
                            ? "out_of_stock"
                            : available <= variant.lowStockThreshold
                              ? "low_stock"
                              : "active"
                        }
                        label={
                          available === 0
                            ? "Out of Stock"
                            : available <= variant.lowStockThreshold
                              ? "Low Stock"
                              : "In Stock"
                        }
                      />
                    </Td>
                    <Td className="pr-4 text-right lg:pr-3">
                      {product.variants.length > 1 ? (
                        <form action={deleteVariantAction}>
                          <input type="hidden" name="variantId" value={variant.id} />
                          <input type="hidden" name="productId" value={product.id} />
                          <button
                            type="submit"
                            title="Retire this variant"
                            className="flex h-8 w-8 items-center justify-center rounded-lg text-neutral-400 transition hover:bg-red-50 hover:text-red-600"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </form>
                      ) : (
                        <span
                          title="A product needs at least one variant to be sellable"
                          className="text-[11px] text-neutral-300"
                        >
                          —
                        </span>
                      )}
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </TableScroll>

        <form
          action={addVariantAction}
          className="mt-4 flex flex-wrap items-end gap-2.5 border-t border-neutral-100 pt-4"
        >
          <input type="hidden" name="productId" value={product.id} />
          <label className="min-w-[7rem] flex-1">
            <span className="mb-1.5 block text-[11px] font-medium text-neutral-500">Colour</span>
            <input name="color" placeholder="Black" className={fieldStyles} />
          </label>
          <label className="min-w-[6rem] flex-1">
            <span className="mb-1.5 block text-[11px] font-medium text-neutral-500">Size</span>
            <input name="size" placeholder="XL" className={fieldStyles} />
          </label>
          <label className="min-w-[7rem] flex-1">
            <span className="mb-1.5 block text-[11px] font-medium text-neutral-500">
              Price override
            </span>
            <input
              name="variantPrice"
              type="number"
              min={0}
              placeholder="Product price"
              className={fieldStyles}
            />
          </label>
          <label className="min-w-[6rem] flex-1">
            <span className="mb-1.5 block text-[11px] font-medium text-neutral-500">Stock</span>
            <input
              name="variantStock"
              type="number"
              min={0}
              defaultValue={0}
              className={fieldStyles}
            />
          </label>
          <button type="submit" className={buttonStyles.secondary}>
            <Plus className="h-4 w-4" />
            Add variant
          </button>
        </form>
      </Card>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="At a glance" />
          <dl className="space-y-2.5 text-sm">
            {[
              ["Storefront URL", `/product/${product.id}`],
              ["Slug", product.slug],
              ["Selling price", formatPrice(product.sellingPrice)],
              ["Last updated", formatDateTime(product.updatedAt ?? product.createdAt)],
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between gap-4">
                <dt className="shrink-0 text-neutral-400">{label}</dt>
                <dd className="min-w-0 truncate text-right font-medium text-neutral-700">{value}</dd>
              </div>
            ))}
          </dl>
        </Card>

        <Card>
          <CardHeader title="Reviews" />
          {product.ratingCount === 0 ? (
            <p className="flex items-center gap-2 py-4 text-sm text-neutral-400">
              <Package className="h-4 w-4" />
              No reviews yet for this product.
            </p>
          ) : (
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1 text-2xl font-bold text-neutral-900">
                {product.ratingAvg}
                <Star className="h-5 w-5 fill-accent-orange text-accent-orange" />
              </span>
              <div className="min-w-0">
                <p className="text-sm text-neutral-600">
                  From {product.ratingCount} review{product.ratingCount === 1 ? "" : "s"}
                </p>
                <Link
                  href={`/admin/products/reviews?search=${encodeURIComponent(product.name)}`}
                  className="text-xs font-semibold text-brand hover:underline"
                >
                  Moderate reviews →
                </Link>
              </div>
            </div>
          )}
        </Card>
      </div>
    </>
  );
}
