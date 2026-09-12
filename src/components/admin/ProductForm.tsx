"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { Info, Loader2, Save, Sparkles } from "lucide-react";
import ChipInput from "./ChipInput";
import ImageUploader from "./ImageUploader";
import VideoUploader from "./VideoUploader";
import { Card, CardHeader, Field, FormMessage, buttonStyles, fieldStyles, textareaStyles } from "./ui";
import type { ProductFormState } from "@/app/admin/(panel)/products/actions";

export interface ProductFormOption {
  id: string;
  label: string;
}

export interface ProductFormValues {
  id?: string;
  name: string;
  sku: string;
  description: string;
  categoryId: string;
  /** Extra categories the product is listed in, besides the primary one. */
  extraCategoryIds: string[];
  brandId: string;
  /** The pre-discount price. */
  price: number;
  discountType: "none" | "percent" | "fixed";
  discountValue: number;
  stock: number;
  lowStockAlert: number;
  colors: string[];
  sizes: string[];
  tags: string[];
  images: string[];
  videos: string[];
  /** Poster still for each video, positionally aligned with `videos`. */
  videoPosters: string[];
  weight: string;
  length: number;
  width: number;
  height: number;
  metaTitle: string;
  metaDescription: string;
  status: string;
  isFeatured: boolean;
  isBestSeller: boolean;
}

interface ProductFormProps {
  mode: "create" | "edit";
  action: (state: ProductFormState, formData: FormData) => Promise<ProductFormState>;
  categories: ProductFormOption[];
  brands: ProductFormOption[];
  values: ProductFormValues;
  /** Stock is edited per variant once a product exists, so the create form
   * owns it and the edit form defers to the variants panel. */
  showStockFields?: boolean;
}

const SIZE_SUGGESTIONS = ["XS", "S", "M", "L", "XL", "XXL", "3XL"];
const COLOR_SUGGESTIONS = ["Black", "White", "Navy", "Grey", "Green", "Red", "Beige"];

export default function ProductForm({
  mode,
  action,
  categories,
  brands,
  values,
  showStockFields = true,
}: ProductFormProps) {
  const [state, formAction, pending] = useActionState<ProductFormState, FormData>(action, {});
  const [discountType, setDiscountType] = useState(values.discountType);
  const [price, setPrice] = useState(String(values.price || ""));
  const [discountValue, setDiscountValue] = useState(String(values.discountValue || ""));
  const [description, setDescription] = useState(values.description);

  // Mirrors the arithmetic in resolvePricing() on the server so the admin can
  // see the shelf price before saving. The server still recomputes it -- this
  // is a preview, not the source of truth.
  const base = Number(price) || 0;
  const discount = Number(discountValue) || 0;
  const finalPrice =
    discountType === "none" || discount <= 0
      ? base
      : discountType === "percent"
        ? Math.max(1, Math.round(base * (1 - Math.min(discount, 99) / 100)))
        : Math.max(0, base - discount);

  return (
    <form action={formAction} className="grid gap-4 xl:grid-cols-12">
      {values.id ? <input type="hidden" name="productId" value={values.id} /> : null}

      <div className="min-w-0 space-y-4 xl:col-span-8">
        <Card>
          <CardHeader title="Basic Information" subtitle="What the product is and what it costs" />

          <div className="space-y-4">
            <FormMessage error={state.error} success={state.success} />

            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Product Name" required className="sm:col-span-3">
                <input
                  name="name"
                  required
                  maxLength={140}
                  defaultValue={values.name}
                  placeholder="Enter product name"
                  className={fieldStyles}
                />
              </Field>

              <Field label="Brand">
                <select name="brandId" defaultValue={values.brandId} className={fieldStyles}>
                  <option value="">Select brand</option>
                  {brands.map((brand) => (
                    <option key={brand.id} value={brand.id}>
                      {brand.label}
                    </option>
                  ))}
                </select>
              </Field>

              <Field
                label="Category"
                className="sm:col-span-2"
                hint="Where the product lives — its breadcrumb and its place in the tree"
              >
                <select name="categoryId" defaultValue={values.categoryId} className={fieldStyles}>
                  <option value="">Select category</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.label}
                    </option>
                  ))}
                </select>
              </Field>

              {/* Cross-listing. The primary category above is what the product
                  page and every report read; these only add the product to
                  other category listings, so a power bank filed under Mobile
                  Accessories can also show up under Home Appliances without
                  pretending to belong there. */}
              <Field
                label="Also list in"
                className="sm:col-span-2"
                hint="Optional — hold Ctrl (⌘ on Mac) to pick more than one"
              >
                <select
                  name="extraCategoryIds"
                  multiple
                  size={6}
                  defaultValue={values.extraCategoryIds}
                  className={`${fieldStyles} h-auto py-2`}
                >
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.label}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Price" required hint="Whole Taka, before any discount">
                <input
                  name="price"
                  type="number"
                  min={1}
                  required
                  value={price}
                  onChange={(event) => setPrice(event.target.value)}
                  placeholder="From price"
                  className={fieldStyles}
                />
              </Field>

              <Field label="Discount Type">
                <select
                  name="discountType"
                  value={discountType}
                  onChange={(event) =>
                    setDiscountType(event.target.value as ProductFormValues["discountType"])
                  }
                  className={fieldStyles}
                >
                  <option value="none">No Discount</option>
                  <option value="percent">Percentage (%)</option>
                  <option value="fixed">Fixed amount (৳)</option>
                </select>
              </Field>

              <Field label="Discount Value">
                <input
                  name="discountValue"
                  type="number"
                  min={0}
                  value={discountValue}
                  onChange={(event) => setDiscountValue(event.target.value)}
                  disabled={discountType === "none"}
                  placeholder={discountType === "percent" ? "e.g. 10" : "e.g. 200"}
                  className={`${fieldStyles} disabled:bg-neutral-50 disabled:text-neutral-400`}
                />
              </Field>

              {discountType !== "none" && discount > 0 && base > 0 ? (
                <p className="flex items-center gap-2 rounded-xl bg-brand-tint px-3.5 py-2.5 text-[13px] text-brand-dark sm:col-span-3">
                  <Sparkles className="h-4 w-4 shrink-0" />
                  Shoppers will pay{" "}
                  <strong>৳ {finalPrice.toLocaleString("en-US")}</strong>, with{" "}
                  <span className="line-through opacity-60">
                    ৳ {base.toLocaleString("en-US")}
                  </span>{" "}
                  shown as the old price.
                </p>
              ) : null}

              {showStockFields ? (
                <>
                  <Field label="Stock Quantity" required hint="Spread across colour/size options">
                    <input
                      name="stock"
                      type="number"
                      min={0}
                      required
                      defaultValue={values.stock}
                      placeholder="Enter stock quantity"
                      className={fieldStyles}
                    />
                  </Field>

                  <Field label="Low Stock Alert" hint="Warn below this many units">
                    <input
                      name="lowStockAlert"
                      type="number"
                      min={0}
                      defaultValue={values.lowStockAlert}
                      placeholder="e.g. 10"
                      className={fieldStyles}
                    />
                  </Field>
                </>
              ) : null}

              <Field label="SKU" hint="Your own product code">
                <input
                  name="sku"
                  maxLength={60}
                  defaultValue={values.sku}
                  placeholder="e.g. ZUP-TS-001"
                  className={fieldStyles}
                />
              </Field>

              <Field label="Description" className="sm:col-span-3">
                <textarea
                  name="description"
                  rows={7}
                  maxLength={5000}
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder="Write product description…"
                  className={textareaStyles}
                />
                <span className="mt-1 block text-right text-[11px] text-neutral-400">
                  {description.length}/5000
                </span>
              </Field>
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Product Images"
            subtitle="The first image is used on listing cards and search results"
          />
          <ImageUploader name="images" initialUrls={values.images} folder="products" max={8} label="Gallery" />
        </Card>

        <Card>
          <CardHeader
            title="Product Videos"
            subtitle="A short demo clip plays first in the storefront gallery"
          />
          <VideoUploader
            name="videos"
            posterName="videoPosters"
            initialUrls={values.videos}
            initialPosters={values.videoPosters}
            max={3}
            label="Clips"
          />
        </Card>

        <Card>
          <CardHeader title="Options" subtitle="Colours and sizes become sellable variants" />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Colours" hint="Named colours or hex codes">
              <ChipInput
                name="colors"
                initial={values.colors}
                placeholder="Black, White…"
                suggestions={COLOR_SUGGESTIONS}
                swatches
              />
            </Field>
            <Field label="Sizes">
              <ChipInput
                name="sizes"
                initial={values.sizes}
                placeholder="S, M, L…"
                suggestions={SIZE_SUGGESTIONS}
              />
            </Field>
          </div>

          {mode === "edit" ? (
            <p className="mt-3 flex items-start gap-2 rounded-xl bg-neutral-50 px-3.5 py-2.5 text-[11px] text-neutral-500">
              <Info className="mt-px h-3.5 w-3.5 shrink-0" />
              Editing these here does not rebuild existing variants — stock lives on them. Use the
              Variants panel below to add or retire individual options.
            </p>
          ) : null}
        </Card>
      </div>

      <div className="min-w-0 space-y-4 xl:col-span-4">
        <Card>
          <CardHeader title="Publish" />
          <div className="space-y-2">
            {[
              { value: "active", label: "Published", detail: "Live on the storefront" },
              { value: "draft", label: "Draft", detail: "Hidden until you publish" },
              { value: "archived", label: "Archived", detail: "Retired, history kept" },
            ].map((option) => (
              <label
                key={option.value}
                className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-neutral-200 px-3 py-2.5 transition has-[:checked]:border-brand has-[:checked]:bg-brand-tint/40"
              >
                <input
                  type="radio"
                  name="status"
                  value={option.value}
                  defaultChecked={values.status === option.value}
                  className="mt-0.5 h-4 w-4 accent-[#16a34a]"
                />
                <span>
                  <span className="block text-[13px] font-semibold text-neutral-800">
                    {option.label}
                  </span>
                  <span className="block text-[11px] text-neutral-400">{option.detail}</span>
                </span>
              </label>
            ))}
          </div>

          <div className="mt-4 space-y-2 border-t border-neutral-100 pt-4">
            <label className="flex cursor-pointer items-center gap-2.5 text-[13px] text-neutral-700">
              <input
                type="checkbox"
                name="isFeatured"
                defaultChecked={values.isFeatured}
                className="h-4 w-4 rounded accent-[#16a34a]"
              />
              Feature on the homepage
            </label>
            <label className="flex cursor-pointer items-center gap-2.5 text-[13px] text-neutral-700">
              <input
                type="checkbox"
                name="isBestSeller"
                defaultChecked={values.isBestSeller}
                className="h-4 w-4 rounded accent-[#16a34a]"
              />
              Mark as best seller
            </label>
          </div>
        </Card>

        <Card>
          <CardHeader title="Shipping" subtitle="Used for delivery estimates" />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Weight (kg)">
              <input
                name="weight"
                type="number"
                step="0.01"
                min={0}
                defaultValue={values.weight}
                placeholder="0.25"
                className={fieldStyles}
              />
            </Field>
            <Field label="Length (cm)">
              <input
                name="length"
                type="number"
                min={0}
                defaultValue={values.length || ""}
                placeholder="30"
                className={fieldStyles}
              />
            </Field>
            <Field label="Width (cm)">
              <input
                name="width"
                type="number"
                min={0}
                defaultValue={values.width || ""}
                placeholder="20"
                className={fieldStyles}
              />
            </Field>
            <Field label="Height (cm)">
              <input
                name="height"
                type="number"
                min={0}
                defaultValue={values.height || ""}
                placeholder="5"
                className={fieldStyles}
              />
            </Field>
          </div>
        </Card>

        <Card>
          <CardHeader title="Organisation & SEO" />
          <div className="space-y-4">
            <Field label="Tags" hint="Helps on-site search find this product">
              <ChipInput name="tags" initial={values.tags} placeholder="cotton, casual…" />
            </Field>
            <Field label="Meta Title">
              <input
                name="metaTitle"
                maxLength={70}
                defaultValue={values.metaTitle}
                placeholder="Enter meta title"
                className={fieldStyles}
              />
            </Field>
            <Field label="Meta Description">
              <textarea
                name="metaDescription"
                rows={3}
                maxLength={160}
                defaultValue={values.metaDescription}
                placeholder="Enter meta description"
                className={textareaStyles}
              />
            </Field>
          </div>
        </Card>
      </div>

      <div className="sticky bottom-0 z-10 -mx-4 flex flex-wrap items-center justify-end gap-2.5 border-t border-black/[0.05] bg-white/95 px-4 py-3 backdrop-blur lg:-mx-6 lg:px-6 xl:col-span-12">
        <Link href="/admin/products" className={buttonStyles.secondary}>
          Cancel
        </Link>
        <button type="submit" disabled={pending} className={buttonStyles.primary}>
          {pending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          {pending ? "Saving…" : mode === "create" ? "Save Product" : "Save Changes"}
        </button>
      </div>
    </form>
  );
}
