import { notFound } from "next/navigation";
import { listBrands } from "@/lib/catalog";
import { listCategoryOptions } from "@/lib/adminData";
import { getCurrentSeller } from "@/lib/sellers";
import { getShopSettings } from "@/lib/shopSettings";
import { getAutoFitMode } from "@/lib/imageFit";
import { statusesFor } from "@/lib/productSave";
import { PageHeader } from "@/components/admin/ui";
import ProductForm from "@/components/admin/ProductForm";
import { publishOptionsFor, sellerAutoFit } from "@/components/seller/productFormOptions";
import { createSellerProductAction } from "../actions";

export const metadata = { title: "Add Product" };

/** The same product form the admin panel uses, so a seller's listing has every
 * part a platform listing has -- gallery, video, options with their own price
 * and stock, shipping details -- and is written by the same save. */
export default async function SellerNewProductPage() {
  const seller = await getCurrentSeller();
  if (!seller) notFound();

  const [categories, brands, autoFit, settings] = await Promise.all([
    listCategoryOptions(),
    listBrands(),
    getAutoFitMode(),
    getShopSettings(),
  ]);

  const owner = {
    kind: "seller" as const,
    sellerId: seller.id,
    needsReview: settings.sellerProductsNeedReview,
  };
  const statuses = statusesFor(owner, null);

  return (
    <>
      <PageHeader
        title="Add Product"
        subtitle={
          settings.sellerProductsNeedReview
            ? "Zupona checks new products before they go live"
            : "It goes live on Zupona as soon as you save"
        }
        breadcrumb={["Products", "Add Product"]}
      />

      <ProductForm
        mode="create"
        action={createSellerProductAction}
        autoFit={sellerAutoFit(autoFit)}
        cancelHref="/seller/products"
        publishOptions={publishOptionsFor(statuses)}
        showMerchandising={false}
        categories={categories.map((option) => ({ id: option.id, label: option.label }))}
        brands={brands.map((brand) => ({ id: brand.id, label: brand.name }))}
        values={{
          name: "",
          sku: "",
          description: "",
          categoryId: "",
          brandId: "",
          price: 0,
          discountType: "none",
          discountValue: 0,
          stock: 0,
          lowStockAlert: settings.lowStockThreshold,
          // A seller's goods are finite; counting them is the safer default
          // for a shop that is not the platform's own warehouse.
          trackInventory: true,
          freeDelivery: false,
          colors: [],
          sizes: [],
          optionGroups: [],
          variantCells: {},
          tags: [],
          images: [],
          videos: [],
          videoPosters: [],
          weight: "",
          length: 0,
          width: 0,
          height: 0,
          metaTitle: "",
          metaDescription: "",
          status: statuses[0],
          isFeatured: false,
          isBestSeller: false,
        }}
      />
    </>
  );
}
