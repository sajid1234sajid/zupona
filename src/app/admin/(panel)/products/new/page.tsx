import { listBrands } from "@/lib/catalog";
import { listCategoryOptions } from "@/lib/adminData";
import { PageHeader } from "@/components/admin/ui";
import ProductForm from "@/components/admin/ProductForm";
import { createProductAction } from "../actions";

export const metadata = { title: "Add Product" };

export default async function NewProductPage() {
  const [categories, brands] = await Promise.all([listCategoryOptions(), listBrands()]);

  return (
    <>
      <PageHeader
        title="Add Product"
        subtitle="Create a new product for your store"
        breadcrumb={["Products", "Add Product"]}
      />

      <ProductForm
        mode="create"
        action={createProductAction}
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
          lowStockAlert: 5,
          // Off by default: a new product sells without a ceiling until the
          // admin says it should be counted.
          trackInventory: false,
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
          status: "active",
          isFeatured: false,
          isBestSeller: false,
        }}
      />
    </>
  );
}
