"use client";

import { useActionState, useState } from "react";
import { ChevronRight, Eye, EyeOff, Loader2, Pencil, Plus, Trash2, X } from "lucide-react";
import ImageUploader from "./ImageUploader";
import { Card, CardHeader, Field, FormMessage, buttonStyles, fieldStyles } from "./ui";
import {
  createCategoryAction,
  deleteCategoryAction,
  toggleCategoryAction,
  updateCategoryAction,
  type CategoryFormState,
} from "@/app/admin/(panel)/categories/actions";
import type { AdminCategory } from "@/lib/adminData";

/** Category tree plus its editor.
 *
 * One component rather than a page and a modal because editing a category is
 * almost always a reaction to seeing it in the list -- clicking a row loads it
 * into the form beside it, and the form doubles as the "add" form when
 * nothing is selected. */
export default function CategoryManager({ tree }: { tree: AdminCategory[] }) {
  const [editing, setEditing] = useState<AdminCategory | null>(null);
  const [expanded, setExpanded] = useState<string[]>(tree.map((node) => node.id));

  const parents = tree.map((node) => ({ id: node.id, name: node.name }));

  return (
    <div className="grid gap-5 xl:grid-cols-12">
      <div className="min-w-0 xl:col-span-7">
        <Card>
          <CardHeader
            title="Category Tree"
            subtitle="Two levels: a category and its subcategories"
          />

          {tree.length === 0 ? (
            <p className="py-10 text-center text-sm text-neutral-400">
              No categories yet. Add your first one on the right.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {tree.map((node) => {
                const open = expanded.includes(node.id);
                return (
                  <li key={node.id}>
                    <CategoryRow
                      category={node}
                      depth={0}
                      selected={editing?.id === node.id}
                      onEdit={() => setEditing(node)}
                      expandable={node.children.length > 0}
                      expanded={open}
                      onToggleExpand={() =>
                        setExpanded((current) =>
                          current.includes(node.id)
                            ? current.filter((entry) => entry !== node.id)
                            : [...current, node.id]
                        )
                      }
                    />

                    {open && node.children.length > 0 ? (
                      <ul className="mt-1.5 space-y-1.5 pl-6">
                        {node.children.map((child) => (
                          <li key={child.id}>
                            <CategoryRow
                              category={child}
                              depth={1}
                              selected={editing?.id === child.id}
                              onEdit={() => setEditing(child)}
                            />
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>

      <div className="min-w-0 xl:col-span-5">
        {editing ? (
          <CategoryForm
            key={editing.id}
            category={editing}
            parents={parents}
            onCancel={() => setEditing(null)}
          />
        ) : (
          <CategoryForm key="new" category={null} parents={parents} onCancel={null} />
        )}
      </div>
    </div>
  );
}

function CategoryRow({
  category,
  depth,
  selected,
  onEdit,
  expandable = false,
  expanded = false,
  onToggleExpand,
}: {
  category: AdminCategory;
  depth: number;
  selected: boolean;
  onEdit: () => void;
  expandable?: boolean;
  expanded?: boolean;
  onToggleExpand?: () => void;
}) {
  // A category still holding products or subcategories cannot be deleted
  // without silently detaching them, so the button is disabled rather than
  // offered and then refused.
  const removable = category.productCount === 0 && category.children.length === 0;

  return (
    <div
      className={`flex items-center gap-2.5 rounded-xl border px-3 py-2.5 transition ${
        selected ? "border-brand bg-brand-tint/40" : "border-neutral-100 hover:border-neutral-200"
      } ${category.isActive ? "" : "opacity-60"}`}
    >
      {expandable ? (
        <button
          type="button"
          onClick={onToggleExpand}
          aria-label={expanded ? "Collapse" : "Expand"}
          aria-expanded={expanded}
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-neutral-400 transition hover:bg-neutral-100"
        >
          <ChevronRight className={`h-4 w-4 transition-transform ${expanded ? "rotate-90" : ""}`} />
        </button>
      ) : (
        <span className="w-6 shrink-0" />
      )}

      <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-neutral-100 bg-neutral-50">
        {category.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={category.imageUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className="text-[10px] text-neutral-300">{depth === 0 ? "CAT" : "SUB"}</span>
        )}
      </span>

      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-semibold text-neutral-800">
          {category.name}
        </span>
        <span className="block truncate text-[11px] text-neutral-400">
          {category.productCount} product{category.productCount === 1 ? "" : "s"}
          {category.subtitle ? ` · ${category.subtitle}` : ""}
          {category.isActive ? "" : " · Hidden"}
        </span>
      </span>

      <div className="flex shrink-0 items-center gap-0.5">
        <button
          type="button"
          onClick={onEdit}
          title="Edit"
          className="flex h-8 w-8 items-center justify-center rounded-lg text-neutral-400 transition hover:bg-neutral-100 hover:text-brand"
        >
          <Pencil className="h-4 w-4" />
        </button>
        <form action={toggleCategoryAction}>
          <input type="hidden" name="categoryId" value={category.id} />
          <button
            type="submit"
            title={category.isActive ? "Hide from the storefront" : "Show on the storefront"}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-700"
          >
            {category.isActive ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
          </button>
        </form>
        <form action={deleteCategoryAction}>
          <input type="hidden" name="categoryId" value={category.id} />
          <button
            type="submit"
            disabled={!removable}
            title={
              removable
                ? "Delete"
                : "Empty this category first — deleting it would un-categorise its products"
            }
            className="flex h-8 w-8 items-center justify-center rounded-lg text-neutral-400 transition hover:bg-red-50 hover:text-red-600 disabled:pointer-events-none disabled:opacity-30"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </form>
      </div>
    </div>
  );
}

function CategoryForm({
  category,
  parents,
  onCancel,
}: {
  category: AdminCategory | null;
  parents: { id: string; name: string }[];
  onCancel: (() => void) | null;
}) {
  const [state, formAction, pending] = useActionState<CategoryFormState, FormData>(
    category ? updateCategoryAction : createCategoryAction,
    {}
  );

  return (
    <Card>
      <CardHeader
        title={category ? "Edit Category" : "Add Category"}
        action={
          onCancel ? (
            <button
              type="button"
              onClick={onCancel}
              className={buttonStyles.ghost}
              aria-label="Stop editing"
            >
              <X className="h-3.5 w-3.5" />
              Cancel
            </button>
          ) : null
        }
      />

      <form action={formAction} className="space-y-4">
        {category ? <input type="hidden" name="categoryId" value={category.id} /> : null}
        <FormMessage error={state.error} success={state.success} />

        <Field label="Name" required>
          <input
            name="name"
            required
            maxLength={80}
            defaultValue={category?.name ?? ""}
            placeholder="e.g. Men's Fashion"
            className={fieldStyles}
          />
        </Field>

        {!category ? (
          <Field label="Parent category" hint="Leave empty to create a top-level category">
            <select name="parentId" defaultValue="" className={fieldStyles}>
              <option value="">None — top level</option>
              {parents.map((parent) => (
                <option key={parent.id} value={parent.id}>
                  {parent.name}
                </option>
              ))}
            </select>
          </Field>
        ) : null}

        <Field label="Subtitle" hint="Short line shown under the name">
          <input
            name="subtitle"
            maxLength={90}
            defaultValue={category?.subtitle ?? ""}
            placeholder="e.g. Shirts, denim & more"
            className={fieldStyles}
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Icon" hint="A lucide icon name">
            <input
              name="icon"
              maxLength={40}
              defaultValue={category?.icon ?? ""}
              placeholder="Shirt"
              className={fieldStyles}
            />
          </Field>
          <Field label="Sort order" hint="Lower shows first">
            <input
              name="sortOrder"
              type="number"
              defaultValue={category?.sortOrder ?? 0}
              className={fieldStyles}
            />
          </Field>
        </div>

        <ImageUploader
          name="image"
          initialUrls={category?.imageUrl ? [category.imageUrl] : []}
          folder="products"
          max={1}
          label="Category Image"
          hint="Square images look best on the category rail"
        />

        <button type="submit" disabled={pending} className={`${buttonStyles.primary} w-full`}>
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          {pending ? "Saving…" : category ? "Save Changes" : "Add Category"}
        </button>
      </form>
    </Card>
  );
}
