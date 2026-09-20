"use client";

import Link from "next/link";
import { useActionState, useMemo, useState } from "react";
import { Info, Loader2, Save, Sparkles } from "lucide-react";
import ChipInput from "./ChipInput";
import ImageUploader from "./ImageUploader";
import VideoUploader from "./VideoUploader";
import OptionGroupBuilder from "./OptionGroupBuilder";
import VariantMatrix from "./VariantMatrix";
import {
  buildMatrix,
  buildOptionsPayload,
  type BuilderGroup,
  type CellOverride,
} from "./optionBuilder";
import { Card, CardHeader, Field, FormMessage, buttonStyles, fieldStyles, textareaStyles } from "./ui";
import { MAX_GROUPS, MAX_VALUES_PER_GROUP, MAX_VARIANTS } from "@/lib/optionModel";
import { applyDiscount } from "@/lib/productDiscount";
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
  brandId: string;
  /** The pre-discount price. */
  price: number;
  discountType: "none" | "percent" | "fixed";
  discountValue: number;
  stock: number;
  lowStockAlert: number;
  /** Whether the product counts its units at all. Off, it sells without a
   * ceiling and every stock box disappears. */
  trackInventory: boolean;
  colors: string[];
  sizes: string[];
  tags: string[];
  images: string[];
  videos: string[];
  /** The options the product already has, and the figures its combinations
   * carry. Empty on a new product. */
  optionGroups: BuilderGroup[];
  variantCells: Record<string, CellOverride>;
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
  /** Ticked when this product carries its own delivery. */
  freeDelivery: boolean;
  /** What the product's `updated_at` was when this form was loaded. Posted
   * back so a save can tell whether anyone else has saved in the meantime. */
  updatedAt?: string | null;
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

export default function ProductForm({
  mode,
  action,
  categories,
  brands,
  values,
  showStockFields = true,
}: ProductFormProps) {
  const [state, formAction, pending] = useActionState<ProductFormState, FormData>(action, {});
  // Moves forward with every successful save, so saving twice from the same
  // open form is not mistaken for two people editing at once.
  const loadedAt = state.savedAt ?? values.updatedAt ?? "";
  const [discountType, setDiscountType] = useState(values.discountType);
  const [price, setPrice] = useState(String(values.price || ""));
  const [discountValue, setDiscountValue] = useState(String(values.discountValue || ""));
  const [description, setDescription] = useState(values.description);

  // The options, the figures each combination carries, and the gallery they can
  // pick a picture from all live here rather than inside the two panels: the
  // matrix is derived from the groups, and both are posted as one field.
  const [groups, setGroups] = useState<BuilderGroup[]>(values.optionGroups);
  const [cells, setCells] = useState<Record<string, CellOverride>>(values.variantCells);
  const [gallery, setGallery] = useState<string[]>(values.images);
  const [stock, setStock] = useState(String(values.stock || ""));
  // Off, the product sells without a ceiling and nothing here has a stock box
  // to fill in -- which is the whole point of the switch. On, every stock
  // control comes back exactly as it was.
  const [trackInventory, setTrackInventory] = useState(values.trackInventory);
  const [lowStockAlert, setLowStockAlert] = useState(String(values.lowStockAlert || ""));

  const matrix = useMemo(() => buildMatrix(groups), [groups]);
  // Only the create form spreads a single entered total across the rows; the
  // edit form shows each combination's real stock instead. The total is
  // optional: a blank box spreads nothing, the rows stay empty, and the new
  // variants start at zero the way an untouched row already does -- stock can
  // be filled in per combination later.
  const defaultStock =
    showStockFields && trackInventory && stock.trim() !== ""
      ? Math.max(0, Number(stock) || 0)
      : undefined;
  const defaultThreshold = showStockFields ? Math.max(0, Number(lowStockAlert) || 0) : undefined;
  const optionsPayload = useMemo(
    () => buildOptionsPayload({ groups, cells, matrix, defaultStock, defaultThreshold }),
    [groups, cells, matrix, defaultStock, defaultThreshold]
  );

  // Mirrors the arithmetic in resolvePricing() on the server so the admin can
  // see the shelf price before saving. The server still recomputes it -- this
  // is a preview, not the source of truth.
  const base = Number(price) || 0;
  const discount = Number(discountValue) || 0;
  const finalPrice = applyDiscount(base, { type: discountType, value: discount });

  return (
    <form action={formAction} className="grid gap-4 xl:grid-cols-12">
      {values.id ? <input type="hidden" name="productId" value={values.id} /> : null}
      {values.id ? <input type="hidden" name="updatedAt" value={loadedAt} /> : null}

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

              <Field label="Category" className="sm:col-span-2">
                <select name="categoryId" defaultValue={values.categoryId} className={fieldStyles}>
                  <option value="">Select category</option>
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

              {showStockFields && trackInventory ? (
                <>
                  <Field label="Stock Quantity" hint="Optional — spread across the combinations">
                    <input
                      name="stock"
                      type="number"
                      min={0}
                      value={stock}
                      onChange={(event) => setStock(event.target.value)}
                      placeholder="Optional"
                      className={fieldStyles}
                    />
                  </Field>

                  <Field label="Low Stock Alert" hint="Warn below this many units">
                    <input
                      name="lowStockAlert"
                      type="number"
                      min={0}
                      value={lowStockAlert}
                      onChange={(event) => setLowStockAlert(event.target.value)}
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
          <ImageUploader
            name="images"
            initialUrls={values.images}
            folder="products"
            max={8}
            label="Gallery"
            onChange={setGallery}
          />
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
          <CardHeader
            title="Options"
            subtitle="However many this product has — colour, size, storage, volume, anything"
          />
          <input type="hidden" name="options" value={optionsPayload} />
          <OptionGroupBuilder
            groups={groups}
            onChange={setGroups}
            maxGroups={MAX_GROUPS}
            maxValues={MAX_VALUES_PER_GROUP}
          />
          {groups.length === 0 ? (
            <p className="mt-3 flex items-start gap-2 rounded-xl bg-neutral-50 px-3.5 py-2.5 text-[11px] text-neutral-500">
              <Info className="mt-px h-3.5 w-3.5 shrink-0" />
              No options yet. The product is sold as a single item — it still has one combination
              below, which is where any stock would live.
            </p>
          ) : null}
        </Card>

      </div>

      <div className="min-w-0 xl:col-span-12 xl:order-last">
        <Card>
          <CardHeader
            title={trackInventory ? "Variants & Stock" : "Variants"}
            subtitle={
              trackInventory
                ? "Every combination the options make, with what it costs and what is left"
                : "Every combination the options make, with what it costs"
            }
          />

          {/* Which kind of stock this product has, as the two words an admin
              would use for it. A hidden field carries the answer rather than a
              checkbox, so "unlimited" posts a real 0 instead of posting nothing
              and having to be inferred from the field's absence. */}
          <div className="mb-4">
            <input type="hidden" name="__present_trackInventory" value="1" />
            <input type="hidden" name="trackInventory" value={trackInventory ? "1" : "0"} />

            <div className="flex w-full gap-2 sm:w-auto">
              {[
                {
                  tracked: false,
                  label: "Unlimited",
                  detail: "Sells without a limit, never shows as out of stock",
                },
                {
                  tracked: true,
                  label: "Limited",
                  detail: "Each combination has its own count and can sell out",
                },
              ].map((option) => (
                <button
                  key={option.label}
                  type="button"
                  aria-pressed={trackInventory === option.tracked}
                  aria-label={`${option.label} stock`}
                  onClick={() => setTrackInventory(option.tracked)}
                  className={`flex-1 rounded-xl border px-3.5 py-3 text-left transition sm:flex-none sm:w-64 ${
                    trackInventory === option.tracked
                      ? "border-brand bg-brand-tint/40"
                      : "border-neutral-200 bg-white hover:border-neutral-300"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <span
                      aria-hidden
                      className={`grid h-4 w-4 shrink-0 place-items-center rounded-full border ${
                        trackInventory === option.tracked
                          ? "border-brand bg-brand"
                          : "border-neutral-300"
                      }`}
                    >
                      {trackInventory === option.tracked ? (
                        <span className="h-1.5 w-1.5 rounded-full bg-white" />
                      ) : null}
                    </span>
                    <span className="text-[13px] font-semibold text-neutral-800">
                      {option.label}
                    </span>
                  </span>
                  <span className="mt-1 block text-[11px] leading-snug text-neutral-400">
                    {option.detail}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <VariantMatrix
            matrix={matrix}
            cells={cells}
            onChange={setCells}
            gallery={gallery}
            defaultStock={defaultStock}
            showStock={trackInventory}
            maxVariants={MAX_VARIANTS}
          />
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
          <CardHeader title="Shipping" subtitle="Delivery charge, weight and size" />

          <label className="mb-4 flex cursor-pointer items-start gap-2.5 rounded-xl border border-neutral-200 bg-neutral-50 p-3.5">
            <input
              type="checkbox"
              name="freeDelivery"
              defaultChecked={values.freeDelivery}
              className="mt-0.5 h-4 w-4 rounded accent-[#16a34a]"
            />
            <span>
              <span className="block text-[13px] font-semibold text-neutral-800">
                Free delivery on this product
              </span>
              {/* Said plainly, because the rule is not what "free delivery"
                  sounds like on its own: an order carries one delivery charge,
                  so a mixed basket cannot be half free. */}
              <span className="block text-[11px] leading-relaxed text-neutral-500">
                An order of only this product (and others marked the same way) is delivered
                free, whatever it comes to. If the cart also holds an ordinary product, the
                shop&rsquo;s usual delivery charge applies to the whole order.
              </span>
            </span>
          </label>

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
