"use client";

import { useActionState, useEffect, useMemo, useState, useTransition } from "react";
import {
  ChevronRight,
  Compass,
  Eye,
  EyeOff,
  GripVertical,
  Home,
  Loader2,
  Pencil,
  Plus,
  Save,
  Search,
  Star,
  Trash2,
  X,
} from "lucide-react";
import ImageUploader from "./ImageUploader";
import { CATEGORY_ICON_NAMES } from "@/components/category/categoryIcons";
import { Card, CardHeader, Field, FormMessage, buttonStyles, fieldStyles } from "./ui";
import {
  createCategoryAction,
  deleteCategoryAction,
  reorderCategoriesAction,
  toggleCategoryFlagAction,
  updateCategoryAction,
  type CategoryFormState,
} from "@/app/admin/(panel)/categories/actions";
import type { AdminCategory } from "@/lib/adminData";

/** Category management: the tree and its editor, on one screen.
 *
 * One component rather than a list page plus an edit page, because editing a
 * category is almost always a reaction to seeing it in the tree -- clicking a
 * row loads it into the form beside it, and the same form doubles as "add"
 * when nothing is selected. A separate route per action would mean three
 * screens for what is one task.
 *
 * Everything the UI decides here is a convenience, never a control: the
 * disabled delete button, the parent list that omits illegal choices, the depth
 * the "Add subcategory" action offers. `src/lib/categoryService.ts` re-checks
 * all of it server-side, because a server action can be called without ever
 * rendering this page.
 */

/** Department -> section -> type. Mirrors MAX_DEPTH in the service; the service
 * is what enforces it. */
const MAX_DEPTH = 3;

interface Flat {
  node: AdminCategory;
  /** Ancestor names, root first. */
  trail: string[];
}

function flatten(nodes: AdminCategory[], trail: string[] = []): Flat[] {
  const out: Flat[] = [];
  for (const node of nodes) {
    out.push({ node, trail });
    out.push(...flatten(node.children, [...trail, node.name]));
  }
  return out;
}

export default function CategoryManager({ tree }: { tree: AdminCategory[] }) {
  const [editing, setEditing] = useState<AdminCategory | null>(null);
  const [addUnder, setAddUnder] = useState<AdminCategory | null>(null);
  const [expanded, setExpanded] = useState<string[]>(() => tree.map((node) => node.id));
  const [term, setTerm] = useState("");
  const [confirming, setConfirming] = useState<AdminCategory | null>(null);

  const flat = useMemo(() => flatten(tree), [tree]);

  const matches = useMemo(() => {
    const needle = term.trim().toLowerCase();
    if (!needle) return null;
    return flat.filter(
      ({ node }) =>
        node.name.toLowerCase().includes(needle) ||
        node.slug.toLowerCase().includes(needle) ||
        (node.nameBn ?? "").toLowerCase().includes(needle)
    );
  }, [flat, term]);

  /** Every category that could legally be a parent, as an indented list.
   *
   * A category cannot sit under itself or under its own descendant, and cannot
   * sit under something already at the deepest level -- so those are simply not
   * offered. The service refuses them anyway. */
  const parentOptions = (self: AdminCategory | null) => {
    const banned = new Set<string>();
    if (self) {
      const mark = (node: AdminCategory) => {
        banned.add(node.id);
        node.children.forEach(mark);
      };
      mark(self);
    }
    // Moving a branch carries its children, so the deepest leaf is what has to
    // fit under the new parent.
    const height = self ? subtreeHeight(self) : 1;

    return flat
      .filter(({ node }) => !banned.has(node.id) && node.depth + height <= MAX_DEPTH)
      .map(({ node }) => ({
        id: node.id,
        label: `${"— ".repeat(node.depth - 1)}${node.name}`,
      }));
  };

  const startAdd = (parent: AdminCategory | null) => {
    setEditing(null);
    setAddUnder(parent);
    if (parent) setExpanded((ids) => (ids.includes(parent.id) ? ids : [...ids, parent.id]));
  };

  return (
    <div className="grid gap-5 xl:grid-cols-12">
      <div className="min-w-0 xl:col-span-7">
        <Card>
          <CardHeader
            title="Category Tree"
            subtitle={`Up to ${MAX_DEPTH} levels · drag a row to reorder it within its level`}
            action={
              <button type="button" onClick={() => startAdd(null)} className={buttonStyles.primary}>
                <Plus className="h-3.5 w-3.5" />
                Add Category
              </button>
            }
          />

          <div className="mb-3 flex items-center gap-2 rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 focus-within:border-brand">
            <Search className="h-4 w-4 shrink-0 text-neutral-400" aria-hidden />
            <input
              type="search"
              value={term}
              onChange={(event) => setTerm(event.target.value)}
              placeholder="Search categories…"
              aria-label="Search categories"
              className="min-w-0 flex-1 bg-transparent text-[13px] outline-none placeholder:text-neutral-400"
            />
            {term && (
              <button
                type="button"
                onClick={() => setTerm("")}
                aria-label="Clear search"
                className="text-neutral-400 hover:text-neutral-600"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {tree.length === 0 ? (
            <p className="py-10 text-center text-sm text-neutral-400">
              No categories yet. Add your first one on the right.
            </p>
          ) : matches ? (
            matches.length === 0 ? (
              <p className="py-10 text-center text-sm text-neutral-400">
                Nothing matches “{term}”.
              </p>
            ) : (
              <ul className="space-y-1.5">
                {matches.map(({ node, trail }) => (
                  <li key={node.id}>
                    <CategoryRow
                      category={node}
                      trail={trail}
                      selected={editing?.id === node.id}
                      onEdit={() => {
                        setAddUnder(null);
                        setEditing(node);
                      }}
                      onAddChild={node.depth < MAX_DEPTH ? () => startAdd(node) : null}
                      onDelete={() => setConfirming(node)}
                    />
                  </li>
                ))}
              </ul>
            )
          ) : (
            <TreeLevel
              nodes={tree}
              parentId={null}
              expanded={expanded}
              onToggleExpand={(id) =>
                setExpanded((ids) =>
                  ids.includes(id) ? ids.filter((entry) => entry !== id) : [...ids, id]
                )
              }
              selectedId={editing?.id ?? null}
              onEdit={(node) => {
                setAddUnder(null);
                setEditing(node);
              }}
              onAddChild={startAdd}
              onDelete={setConfirming}
            />
          )}
        </Card>
      </div>

      <div className="min-w-0 xl:col-span-5">
        <CategoryForm
          key={editing?.id ?? `new-${addUnder?.id ?? "root"}`}
          category={editing}
          defaultParentId={addUnder?.id ?? null}
          parents={parentOptions(editing)}
          onCancel={
            editing || addUnder
              ? () => {
                  setEditing(null);
                  setAddUnder(null);
                }
              : null
          }
        />
      </div>

      {confirming && (
        <DeleteDialog
          category={confirming}
          destinations={flat
            .filter(({ node }) => node.id !== confirming.id)
            .map(({ node }) => ({ id: node.id, label: `${"— ".repeat(node.depth - 1)}${node.name}` }))}
          onClose={() => setConfirming(null)}
          onDeleted={() => {
            if (editing?.id === confirming.id) setEditing(null);
            setConfirming(null);
          }}
        />
      )}
    </div>
  );
}

function subtreeHeight(node: AdminCategory): number {
  if (node.children.length === 0) return 1;
  return 1 + Math.max(...node.children.map(subtreeHeight));
}

/* -------------------------------------------------------------------------- */
/* Tree                                                                       */
/* -------------------------------------------------------------------------- */

/** One level of the tree, and the drag-and-drop that reorders it.
 *
 * Dragging is scoped to a level: a row can be dropped above or below its
 * siblings but never onto another branch, because moving between branches
 * changes a category's *parent* -- a decision with depth consequences that
 * belongs in the form, next to the warning about it, rather than in a gesture
 * that can be made by accident.
 *
 * The new order is sent as a whole array rather than as one moved id, so the
 * server writes positions 0..n and never has to reconcile a partial order. */
function TreeLevel({
  nodes,
  parentId,
  expanded,
  onToggleExpand,
  selectedId,
  onEdit,
  onAddChild,
  onDelete,
  depth = 0,
}: {
  nodes: AdminCategory[];
  parentId: string | null;
  expanded: string[];
  onToggleExpand: (id: string) => void;
  selectedId: string | null;
  onEdit: (node: AdminCategory) => void;
  onAddChild: (node: AdminCategory) => void;
  onDelete: (node: AdminCategory) => void;
  depth?: number;
}) {
  const [order, setOrder] = useState<string[] | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();

  // `order` holds the optimistic arrangement while a drag is in flight; once
  // the server has written it, the refreshed props are the truth again.
  const ids = order ?? nodes.map((node) => node.id);
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const ordered = ids.map((id) => byId.get(id)).filter(Boolean) as AdminCategory[];

  const moveTo = (targetId: string) => {
    if (!dragId || dragId === targetId) return;
    const next = ids.filter((id) => id !== dragId);
    next.splice(next.indexOf(targetId), 0, dragId);
    setOrder(next);
  };

  const commit = () => {
    setDragId(null);
    const next = order;
    if (!next) return;
    startSaving(async () => {
      await reorderCategoriesAction(parentId, next);
      setOrder(null);
    });
  };

  return (
    <ul className={`space-y-1.5 ${depth > 0 ? "mt-1.5 pl-6" : ""}`}>
      {ordered.map((node) => {
        const open = expanded.includes(node.id);
        return (
          <li
            key={node.id}
            draggable
            onDragStart={() => setDragId(node.id)}
            onDragOver={(event) => {
              event.preventDefault();
              moveTo(node.id);
            }}
            onDrop={(event) => {
              event.preventDefault();
              commit();
            }}
            onDragEnd={commit}
            className={dragId === node.id ? "opacity-50" : undefined}
          >
            <CategoryRow
              category={node}
              selected={selectedId === node.id}
              onEdit={() => onEdit(node)}
              onAddChild={node.depth < MAX_DEPTH ? () => onAddChild(node) : null}
              onDelete={() => onDelete(node)}
              expandable={node.children.length > 0}
              expanded={open}
              onToggleExpand={() => onToggleExpand(node.id)}
              busy={saving}
              draggable
            />

            {open && node.children.length > 0 && (
              <TreeLevel
                nodes={node.children}
                parentId={node.id}
                expanded={expanded}
                onToggleExpand={onToggleExpand}
                selectedId={selectedId}
                onEdit={onEdit}
                onAddChild={onAddChild}
                onDelete={onDelete}
                depth={depth + 1}
              />
            )}
          </li>
        );
      })}
    </ul>
  );
}

function CategoryRow({
  category,
  trail,
  selected,
  onEdit,
  onAddChild,
  onDelete,
  expandable = false,
  expanded = false,
  onToggleExpand,
  busy = false,
  draggable = false,
}: {
  category: AdminCategory;
  trail?: string[];
  selected: boolean;
  onEdit: () => void;
  onAddChild: (() => void) | null;
  onDelete: () => void;
  expandable?: boolean;
  expanded?: boolean;
  onToggleExpand?: () => void;
  busy?: boolean;
  draggable?: boolean;
}) {
  const thumbnail = category.imageUrl ?? category.iconUrl;

  return (
    <div
      className={`flex items-center gap-2 rounded-xl border px-2.5 py-2 transition ${
        selected ? "border-brand bg-brand-tint/40" : "border-neutral-100 hover:border-neutral-200"
      } ${category.isActive ? "" : "opacity-60"}`}
    >
      {draggable ? (
        <span
          className="shrink-0 cursor-grab text-neutral-300 active:cursor-grabbing"
          aria-hidden
          title="Drag to reorder"
        >
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin text-brand" />
          ) : (
            <GripVertical className="h-4 w-4" />
          )}
        </span>
      ) : null}

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
        {thumbnail ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={thumbnail} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className="text-[10px] text-neutral-300">L{category.depth}</span>
        )}
      </span>

      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-semibold text-neutral-800">
          {category.name}
          {category.nameBn ? (
            <span className="ml-1.5 text-[11px] font-normal text-neutral-400">
              {category.nameBn}
            </span>
          ) : null}
        </span>
        <span className="block truncate text-[11px] text-neutral-400">
          {trail && trail.length > 0 ? `${trail.join(" › ")} · ` : ""}
          /{category.slug} · {category.productCount} product
          {category.productCount === 1 ? "" : "s"}
          {category.children.length > 0 ? ` · ${category.children.length} sub` : ""}
          {category.isActive ? "" : " · Hidden"}
        </span>
      </span>

      <span className="flex shrink-0 items-center gap-0.5">
        <FlagToggle
          categoryId={category.id}
          flag="active"
          on={category.isActive}
          onIcon={Eye}
          offIcon={EyeOff}
          label={category.isActive ? "Visible on the storefront" : "Hidden from the storefront"}
        />
        <FlagToggle
          categoryId={category.id}
          flag="featured"
          on={category.isFeatured}
          onIcon={Star}
          offIcon={Star}
          label={category.isFeatured ? "Featured" : "Not featured"}
        />
        <FlagToggle
          categoryId={category.id}
          flag="homepage"
          on={category.showOnHomepage}
          onIcon={Home}
          offIcon={Home}
          label={category.showOnHomepage ? "Shown on the homepage" : "Hidden from the homepage"}
        />
        <FlagToggle
          categoryId={category.id}
          flag="navigation"
          on={category.showInNavigation}
          onIcon={Compass}
          offIcon={Compass}
          label={category.showInNavigation ? "In the menu" : "Not in the menu"}
        />

        <span className="mx-0.5 h-5 w-px bg-neutral-100" aria-hidden />

        {onAddChild ? (
          <button
            type="button"
            onClick={onAddChild}
            title="Add a subcategory"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-neutral-400 transition hover:bg-neutral-100 hover:text-brand"
          >
            <Plus className="h-4 w-4" />
          </button>
        ) : null}
        <button
          type="button"
          onClick={onEdit}
          title="Edit"
          className="flex h-8 w-8 items-center justify-center rounded-lg text-neutral-400 transition hover:bg-neutral-100 hover:text-brand"
        >
          <Pencil className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={onDelete}
          title="Delete"
          className="flex h-8 w-8 items-center justify-center rounded-lg text-neutral-400 transition hover:bg-red-50 hover:text-red-600"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </span>
    </div>
  );
}

/** One placement switch. The button posts the flag and the state it wants in a
 * single value, so all four live in one form rather than four nested ones. */
function FlagToggle({
  categoryId,
  flag,
  on,
  onIcon: OnIcon,
  offIcon: OffIcon,
  label,
}: {
  categoryId: string;
  flag: string;
  on: boolean;
  onIcon: typeof Eye;
  offIcon: typeof Eye;
  label: string;
}) {
  const Icon = on ? OnIcon : OffIcon;

  return (
    <form action={toggleCategoryFlagAction} className="contents">
      <input type="hidden" name="categoryId" value={categoryId} />
      <button
        type="submit"
        name="toggle"
        value={`${flag}:${on ? "0" : "1"}`}
        title={label}
        aria-label={label}
        aria-pressed={on}
        className={`flex h-8 w-8 items-center justify-center rounded-lg transition hover:bg-neutral-100 ${
          on ? "text-brand" : "text-neutral-300"
        }`}
      >
        <Icon className="h-4 w-4" fill={on && flag === "featured" ? "currentColor" : "none"} />
      </button>
    </form>
  );
}

/* -------------------------------------------------------------------------- */
/* Editor                                                                     */
/* -------------------------------------------------------------------------- */

function CategoryForm({
  category,
  defaultParentId,
  parents,
  onCancel,
}: {
  category: AdminCategory | null;
  defaultParentId: string | null;
  parents: { id: string; label: string }[];
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
        subtitle={category ? `Level ${category.depth} · /${category.slug}` : undefined}
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

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Name (English)" required>
            <input
              name="name"
              required
              maxLength={80}
              defaultValue={category?.name ?? ""}
              placeholder="e.g. Mobiles"
              className={fieldStyles}
            />
          </Field>
          <Field label="Name (Bangla)" hint="Optional">
            <input
              name="nameBn"
              maxLength={80}
              defaultValue={category?.nameBn ?? ""}
              placeholder="মোবাইল"
              className={fieldStyles}
            />
          </Field>
        </div>

        <Field
          label="URL slug"
          hint={
            category
              ? "Changing this breaks existing links — leave it alone unless you mean to"
              : "Leave empty to build it from the name"
          }
        >
          <input
            name="slug"
            maxLength={60}
            defaultValue={category?.slug ?? ""}
            placeholder="mobiles"
            className={fieldStyles}
          />
        </Field>

        <Field label="Parent category" hint={`Top level, or under an existing one (max ${MAX_DEPTH} levels)`}>
          <select
            name="parentId"
            defaultValue={category?.parentId ?? defaultParentId ?? ""}
            className={fieldStyles}
          >
            <option value="">None — top level</option>
            {parents.map((parent) => (
              <option key={parent.id} value={parent.id}>
                {parent.label}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Tagline" hint="One line under the name on a tile">
          <input
            name="subtitle"
            maxLength={90}
            defaultValue={category?.subtitle ?? ""}
            placeholder="e.g. Smartphones, tablets & more"
            className={fieldStyles}
          />
        </Field>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Description (English)" hint="Shown on the category page">
            <textarea
              name="descriptionEn"
              rows={3}
              maxLength={500}
              defaultValue={category?.descriptionEn ?? ""}
              className={fieldStyles}
            />
          </Field>
          <Field label="Description (Bangla)" hint="Optional">
            <textarea
              name="descriptionBn"
              rows={3}
              maxLength={500}
              defaultValue={category?.descriptionBn ?? ""}
              className={fieldStyles}
            />
          </Field>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field
            label="Icon name"
            hint="Pick one, or leave empty — the rail guesses from the name"
          >
            <input
              name="icon"
              maxLength={40}
              list="category-icon-names"
              defaultValue={category?.icon ?? ""}
              placeholder="Smartphone"
              className={fieldStyles}
            />
            {/* A datalist rather than a <select>: the admin can still type a
                name this build does not know about, which then falls back to
                the guess instead of being rejected. */}
            <datalist id="category-icon-names">
              {CATEGORY_ICON_NAMES.map((name) => (
                <option key={name} value={name} />
              ))}
            </datalist>
          </Field>
          <Field label="Sort order" hint="Lower shows first; dragging the tree rewrites this">
            <input
              name="sortOrder"
              type="number"
              // Empty on the add form, not 0: an explicit 0 would tie every new
              // category with whatever already sits first in its level. Left
              // blank, the service appends it to the end instead.
              defaultValue={category ? category.sortOrder : ""}
              placeholder="Auto"
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
          hint="Square artwork, WEBP or AVIF where you can · up to 10 MB"
        />

        <ImageUploader
          name="iconImage"
          initialUrls={category?.iconUrl ? [category.iconUrl] : []}
          folder="products"
          max={1}
          label="Category Icon"
          hint="Small round icon for the navigation rails · optional"
        />

        <fieldset className="rounded-xl border border-neutral-100 p-3">
          <legend className="px-1 text-[11px] font-semibold uppercase tracking-wide text-neutral-400">
            Where it appears
          </legend>
          <div className="grid gap-2 sm:grid-cols-2">
            <Switch
              name="isActive"
              label="Active"
              hint="Hidden categories vanish from the shop"
              defaultChecked={category?.isActive ?? true}
            />
            <Switch
              name="isFeatured"
              label="Featured"
              defaultChecked={category?.isFeatured ?? false}
            />
            <Switch
              name="showOnHomepage"
              label="Show on homepage"
              defaultChecked={category?.showOnHomepage ?? true}
            />
            <Switch
              name="showInNavigation"
              label="Show in navigation"
              defaultChecked={category?.showInNavigation ?? true}
            />
          </div>
        </fieldset>

        <fieldset className="rounded-xl border border-neutral-100 p-3">
          <legend className="px-1 text-[11px] font-semibold uppercase tracking-wide text-neutral-400">
            SEO
          </legend>
          <div className="space-y-3">
            <Field label="Meta title" hint="Falls back to the category name">
              <input
                name="seoTitle"
                maxLength={120}
                defaultValue={category?.seoTitle ?? ""}
                className={fieldStyles}
              />
            </Field>
            <Field label="Meta description" hint="Falls back to the description">
              <textarea
                name="seoDescription"
                rows={2}
                maxLength={300}
                defaultValue={category?.seoDescription ?? ""}
                className={fieldStyles}
              />
            </Field>
          </div>
        </fieldset>

        <button type="submit" disabled={pending} className={`${buttonStyles.primary} w-full`}>
          {pending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : category ? (
            <Save className="h-4 w-4" />
          ) : (
            <Plus className="h-4 w-4" />
          )}
          {pending ? "Saving…" : category ? "Save Changes" : "Add Category"}
        </button>
      </form>
    </Card>
  );
}

function Switch({
  name,
  label,
  hint,
  defaultChecked,
}: {
  name: string;
  label: string;
  hint?: string;
  defaultChecked: boolean;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-2 rounded-lg px-1 py-1.5 hover:bg-neutral-50">
      <input
        type="checkbox"
        name={name}
        defaultChecked={defaultChecked}
        className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--color-brand)]"
      />
      <span className="min-w-0">
        <span className="block text-[13px] text-neutral-700">{label}</span>
        {hint ? <span className="block text-[11px] text-neutral-400">{hint}</span> : null}
      </span>
    </label>
  );
}

/* -------------------------------------------------------------------------- */
/* Deletion                                                                   */
/* -------------------------------------------------------------------------- */

/** Deleting a category is the one action here that can lose something, so it
 * asks first and says exactly what is in the way.
 *
 * Subcategories block it outright -- they have to be moved or deleted
 * themselves, which is a decision per child. Products only need somewhere to
 * go, so the dialog asks where and the server moves them in the same batch as
 * the delete. */
function DeleteDialog({
  category,
  destinations,
  onClose,
  onDeleted,
}: {
  category: AdminCategory;
  destinations: { id: string; label: string }[];
  onClose: () => void;
  onDeleted: () => void;
}) {
  const [state, formAction, pending] = useActionState<CategoryFormState, FormData>(
    deleteCategoryAction,
    {}
  );

  const blockedByChildren = category.children.length > 0;
  const needsReassignment = category.productCount > 0;

  // Closing is an effect, not a render-time call: the action resolves, the tree
  // is revalidated, and only then does the dialog go away.
  useEffect(() => {
    if (state.success) onDeleted();
  }, [state.success, onDeleted]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button aria-label="Cancel" onClick={onClose} className="absolute inset-0 bg-black/40" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Delete ${category.name}`}
        className="relative w-full max-w-md rounded-2xl bg-white p-5 shadow-xl"
      >
        <h2 className="text-[15px] font-bold text-neutral-800">Delete “{category.name}”?</h2>

        {blockedByChildren ? (
          <p className="mt-2 text-[13px] text-neutral-500">
            It still has {category.children.length} subcategor
            {category.children.length === 1 ? "y" : "ies"}. Move or delete{" "}
            {category.children.length === 1 ? "it" : "them"} first — deleting a parent would leave
            them stranded.
          </p>
        ) : (
          <p className="mt-2 text-[13px] text-neutral-500">
            Products are never deleted with a category.
            {needsReassignment
              ? ` ${category.productCount} product${
                  category.productCount === 1 ? " is" : "s are"
                } filed here, so choose where ${
                  category.productCount === 1 ? "it goes" : "they go"
                }.`
              : " Nothing is filed here, so this only removes the category itself."}
          </p>
        )}

        <form action={formAction} className="mt-4 space-y-3">
          <input type="hidden" name="categoryId" value={category.id} />
          <FormMessage error={state.error} success={state.success} />

          {!blockedByChildren && needsReassignment && (
            <Field label="Move products to" required>
              <select name="reassignTo" required defaultValue="" className={fieldStyles}>
                <option value="" disabled>
                  Choose a category…
                </option>
                {destinations.map((destination) => (
                  <option key={destination.id} value={destination.id}>
                    {destination.label}
                  </option>
                ))}
              </select>
            </Field>
          )}

          <div className="flex gap-2">
            <button type="button" onClick={onClose} className={`${buttonStyles.ghost} flex-1 justify-center`}>
              Cancel
            </button>
            <button
              type="submit"
              disabled={pending || blockedByChildren}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-red-600 px-4 py-2 text-[13px] font-semibold text-white transition hover:bg-red-700 disabled:opacity-40"
            >
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              Delete
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
