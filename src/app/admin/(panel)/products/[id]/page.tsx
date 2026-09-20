import { notFound } from "next/navigation";
import { Eye } from "lucide-react";
import { listBrands } from "@/lib/catalog";
import { getProductForEdit } from "@/lib/adminData";
import { formatDateTime } from "@/lib/format";
import { listCategoryOptions } from "@/lib/adminData";
import ProductForm from "@/components/admin/ProductForm";
import { cellsFromVariants, groupsFromProduct } from "@/components/admin/optionBuilder";
import { PageHeader, buttonStyles } from "@/components/admin/ui";
import { updateProductAction } from "../actions";

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

  // Only what is actually sellable; a retired combination keeps its stock but
  // is not on the shelf, so counting it would overstate what can be bought.
  const totalStock = product.variants
    .filter((variant) => variant.isActive)
    .reduce((sum, variant) => sum + variant.stockQuantity, 0);

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
          Product created. Its options and stock are in the panels below.
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
