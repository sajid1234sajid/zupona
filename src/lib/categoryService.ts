/** The category system: one tree read, one set of validated mutations.
 *
 * Everything category-shaped goes through here -- the storefront's navigation,
 * the homepage rails, the landing pages, and the admin panel's editor. The
 * point is that there is exactly one place that knows what a valid category
 * tree looks like, so a rule added here (depth, slugs, safe deletion) holds for
 * every caller rather than only the screen it was written for.
 *
 * Two things are deliberate:
 *
 *  - **One query, not one per node.** The whole tree and every product count
 *    come back in a single statement; the parent/child links are stitched in
 *    JavaScript. Walking the table with a query per level is what made the old
 *    per-category COUNT(*) expensive enough to notice in D1's row budget.
 *  - **KV caches rows, not the tree.** A Map does not survive JSON, so the flat
 *    rows are what is cached and the index is rebuilt per request -- which is
 *    pure CPU on an array of a few dozen items. `invalidateCatalog()` after a
 *    mutation is what makes an edit show up on the shop.
 *
 * Mutations validate server-side and never trust the form: the admin UI hides
 * an illegal parent, but `assignParent()` is what actually refuses it. */

import { getDB } from "@/lib/db";
import { CacheKeys, cached, invalidateCatalog } from "@/lib/cache";

/* -------------------------------------------------------------------------- */
/* Rules                                                                      */
/* -------------------------------------------------------------------------- */

/** Department -> section -> type. A fourth level has nowhere to render and
 * turns the mega menu into a wall of links, so it is refused rather than
 * quietly flattened. */
export const MAX_DEPTH = 3;

export const CATEGORY_ROOT_PATH = "/category";

const MAX_NAME_LENGTH = 80;
const MAX_SLUG_LENGTH = 60;

/** Thrown for anything a person can fix by changing what they typed. Callers
 * turn it into a form message; anything else is a real fault and propagates. */
export class CategoryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CategoryError";
  }
}

/* -------------------------------------------------------------------------- */
/* Shapes                                                                     */
/* -------------------------------------------------------------------------- */

export interface CategoryRow {
  id: string;
  parent_id: string | null;
  name: string;
  name_en: string | null;
  name_bn: string | null;
  slug: string;
  subtitle: string | null;
  description_en: string | null;
  description_bn: string | null;
  image_url: string | null;
  icon: string | null;
  icon_url: string | null;
  sort_order: number;
  is_active: number;
  is_featured: number;
  show_on_homepage: number;
  show_in_navigation: number;
  seo_title: string | null;
  seo_description: string | null;
  product_count: number;
}

export interface CategoryNode {
  id: string;
  parentId: string | null;
  /** Display name. `nameEn` is kept equal to it; `nameBn` is the Bangla name. */
  name: string;
  nameEn: string;
  nameBn: string | null;
  slug: string;
  /** One-line tagline printed under a tile. */
  subtitle: string | null;
  descriptionEn: string | null;
  descriptionBn: string | null;
  imageUrl: string | null;
  /** A lucide icon name, e.g. "Shirt". */
  icon: string | null;
  /** An uploaded icon image, served from /api/media/. */
  iconUrl: string | null;
  sortOrder: number;
  isActive: boolean;
  isFeatured: boolean;
  showOnHomepage: boolean;
  showInNavigation: boolean;
  seoTitle: string | null;
  seoDescription: string | null;
  /** 1 for a department, 3 for the deepest level. */
  depth: number;
  /** Slugs from the root down to and including this category. */
  path: string[];
  /** Canonical public URL, e.g. /category/electronics/mobiles. */
  href: string;
  /** Ancestors, root first. */
  ancestors: { id: string; name: string; slug: string; href: string }[];
  /** Products filed directly under this category. */
  productCount: number;
  /** Products under this category or anything beneath it. */
  totalProductCount: number;
  children: CategoryNode[];
}

/* -------------------------------------------------------------------------- */
/* Reading                                                                    */
/* -------------------------------------------------------------------------- */

/** Every category with its direct product count.
 *
 * The count spans both the primary link (`products.category_id`) and the
 * cross-listing table, de-duplicated by the UNION so a product filed both ways
 * is counted once. */
const TREE_QUERY = `
  SELECT c.id, c.parent_id, c.name, c.name_en, c.name_bn, c.slug, c.subtitle,
         c.description_en, c.description_bn, c.image_url, c.icon, c.icon_url,
         c.sort_order, c.is_active, c.is_featured, c.show_on_homepage,
         c.show_in_navigation, c.seo_title, c.seo_description,
         COALESCE(counts.n, 0) AS product_count
    FROM categories c
    LEFT JOIN (
      SELECT category_id, COUNT(*) AS n FROM (
        SELECT id AS product_id, category_id FROM products
         WHERE status = 'active' AND category_id IS NOT NULL
        UNION
        SELECT pc.product_id, pc.category_id
          FROM product_categories pc
          JOIN products p ON p.id = pc.product_id
         WHERE p.status = 'active'
      ) GROUP BY category_id
    ) counts ON counts.category_id = c.id
   ORDER BY c.sort_order ASC, c.name ASC`;

/** Thrown when the database predates migration 0009.
 *
 * A distinct type so the failure is greppable in the logs and cannot be
 * mistaken for an ordinary query fault. */
export class MigrationRequiredError extends Error {
  constructor(cause: unknown) {
    super(
      "The category system requires migration 0009 (db/migrations/0009_category_system.sql), " +
        "which has not been applied to this database. Apply it with " +
        "`npx wrangler d1 execute zupona-v3-db --remote --file=./db/migrations/0009_category_system.sql` " +
        "(and --local for development). See DATABASE.md."
    );
    this.name = "MigrationRequiredError";
    this.cause = cause;
  }
}

/** Reads every category and its direct product count.
 *
 * There is deliberately no fallback for a database that has not had migration
 * 0009 applied. An earlier version degraded to the pre-0009 columns so the page
 * would still render, which meant a deploy that had skipped the migration
 * looked healthy while the placement flags silently took default values and
 * every cross-listing was invisible. A missing migration is a broken deploy and
 * should read as one.
 *
 * The `catch` here is not that fallback returning: it recovers no data and
 * serves no request. It replaces D1's "no such column: c.name_en" with a
 * sentence naming the migration and the command that applies it, then rethrows
 * so the page still fails. Anything that is not a missing-schema error is
 * rethrown untouched, so a genuine database fault is never relabelled.
 *
 * The gate belongs in the pipeline -- 0009 must be applied to the remote D1
 * before the Worker that needs it ships. See DATABASE.md. */
async function queryCategoryRows(): Promise<CategoryRow[]> {
  const db = await getDB();

  try {
    const { results } = await db.prepare(TREE_QUERY).all<CategoryRow>();
    return results;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    // SQLite's wording for a column or table the schema does not have.
    if (/no such (column|table)/i.test(message)) {
      throw new MigrationRequiredError(error);
    }
    throw error;
  }
}

/** Cached for ten minutes, cleared by every mutation here. */
const TREE_TTL_SECONDS = 600;

async function loadRows(): Promise<CategoryRow[]> {
  return cached(CacheKeys.categoryTree(), queryCategoryRows, TREE_TTL_SECONDS);
}

export interface CategoryIndex {
  /** Every node, flat, in tree order. */
  all: CategoryNode[];
  /** Top-level nodes, each carrying its subtree. */
  roots: CategoryNode[];
  byId: Map<string, CategoryNode>;
  bySlug: Map<string, CategoryNode>;
}

function toNode(row: CategoryRow): CategoryNode {
  return {
    id: row.id,
    parentId: row.parent_id,
    name: row.name,
    nameEn: row.name_en ?? row.name,
    nameBn: row.name_bn,
    slug: row.slug,
    subtitle: row.subtitle,
    descriptionEn: row.description_en,
    descriptionBn: row.description_bn,
    imageUrl: row.image_url,
    icon: row.icon,
    iconUrl: row.icon_url,
    sortOrder: row.sort_order,
    isActive: row.is_active === 1,
    isFeatured: row.is_featured === 1,
    showOnHomepage: row.show_on_homepage === 1,
    showInNavigation: row.show_in_navigation === 1,
    seoTitle: row.seo_title,
    seoDescription: row.seo_description,
    depth: 1,
    path: [],
    href: CATEGORY_ROOT_PATH,
    ancestors: [],
    productCount: row.product_count,
    totalProductCount: row.product_count,
    children: [],
  };
}

/** Builds the tree from the flat rows.
 *
 * A row whose parent is missing (deactivated, or deleted before the FK was
 * added) is promoted to a root rather than dropped -- losing a category
 * silently is worse than showing it one level too high. A parent chain that
 * somehow loops is cut at MAX_DEPTH, so a bad row can never hang the walk. */
function buildIndex(rows: CategoryRow[], activeOnly: boolean): CategoryIndex {
  const usable = activeOnly ? rows.filter((row) => row.is_active === 1) : rows;

  const byId = new Map<string, CategoryNode>();
  for (const row of usable) byId.set(row.id, toNode(row));

  const roots: CategoryNode[] = [];
  for (const node of byId.values()) {
    const parent = node.parentId ? byId.get(node.parentId) : undefined;
    if (parent) parent.children.push(node);
    else roots.push(node);
  }

  const sortNodes = (nodes: CategoryNode[]) =>
    nodes.sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));

  const all: CategoryNode[] = [];
  const bySlug = new Map<string, CategoryNode>();

  const walk = (
    nodes: CategoryNode[],
    depth: number,
    path: string[],
    ancestors: CategoryNode["ancestors"]
  ): number => {
    sortNodes(nodes);
    let subtreeTotal = 0;

    for (const node of nodes) {
      node.depth = depth;
      node.path = [...path, node.slug];
      node.href = `${CATEGORY_ROOT_PATH}/${node.path.join("/")}`;
      node.ancestors = ancestors;

      all.push(node);
      bySlug.set(node.slug, node);

      const below =
        depth < MAX_DEPTH
          ? walk(node.children, depth + 1, node.path, [
              ...ancestors,
              { id: node.id, name: node.name, slug: node.slug, href: node.href },
            ])
          : 0;

      node.totalProductCount = node.productCount + below;
      subtreeTotal += node.totalProductCount;
    }

    return subtreeTotal;
  };

  walk(roots, 1, [], []);

  return { all, roots, byId, bySlug };
}

/** The public tree: active categories only. */
export async function getCategoryIndex(): Promise<CategoryIndex> {
  return buildIndex(await loadRows(), true);
}

/** The admin tree: hidden categories included, because that is what makes them
 * un-hideable again. */
export async function getAdminCategoryIndex(): Promise<CategoryIndex> {
  return buildIndex(await queryCategoryRows(), false);
}

/** GET category tree. */
export async function getCategoryTree(): Promise<CategoryNode[]> {
  return (await getCategoryIndex()).roots;
}

/** GET category by slug. Falls back to the id so links minted before slugs
 * became the public identifier keep resolving. */
export async function getCategoryBySlug(slugOrId: string): Promise<CategoryNode | null> {
  const index = await getCategoryIndex();
  return index.bySlug.get(slugOrId) ?? index.byId.get(slugOrId) ?? null;
}

/** Resolves `/category/electronics/mobiles/smartphones`.
 *
 * The last segment is what identifies the category; the ones before it are
 * checked against its real ancestry. A path that names the right category by
 * the wrong route still resolves, and the caller redirects to `node.href` --
 * one address per category, which is what the canonical tag promises. */
export async function getCategoryByPath(
  segments: string[]
): Promise<{ node: CategoryNode; canonical: boolean } | null> {
  const clean = segments.filter(Boolean);
  if (clean.length === 0) return null;

  const node = await getCategoryBySlug(clean[clean.length - 1]);
  if (!node) return null;

  const canonical =
    clean.length === node.path.length && clean.every((segment, i) => segment === node.path[i]);

  return { node, canonical };
}

/** GET children of category. */
export async function getCategoryChildren(slugOrId: string): Promise<CategoryNode[]> {
  return (await getCategoryBySlug(slugOrId))?.children ?? [];
}

/** GET featured categories. */
export async function getFeaturedCategories(limit = 12): Promise<CategoryNode[]> {
  const { all } = await getCategoryIndex();
  return all.filter((node) => node.isFeatured).slice(0, limit);
}

/** GET homepage categories -- the tiles on the storefront's front page. */
export async function getHomepageCategories(limit = 12): Promise<CategoryNode[]> {
  const { roots } = await getCategoryIndex();
  const shown = roots.filter((node) => node.showOnHomepage);
  return shown.slice(0, limit);
}

/** How many homepage categories exist in total, so the grid knows whether it
 * is hiding any behind "View all". */
export async function countHomepageCategories(): Promise<number> {
  const { roots } = await getCategoryIndex();
  return roots.filter((node) => node.showOnHomepage).length;
}

/** GET navigation categories -- the mega menu and the mobile drill-down. */
export async function getNavigationTree(limit = 12): Promise<CategoryNode[]> {
  const { roots } = await getCategoryIndex();
  return roots.filter((node) => node.showInNavigation).slice(0, limit);
}

/* -------------------------------------------------------------------------- */
/* Navigation projection                                                      */
/* -------------------------------------------------------------------------- */

/** The trimmed node the client navigation components receive.
 *
 * A full `CategoryNode` carries SEO copy, descriptions and an ancestor chain
 * that the mega menu and the mobile drill-down never render. Handing the whole
 * tree to the browser would put all of it in the RSC payload of every page, so
 * navigation gets its own narrower shape. */
export interface NavCategory {
  id: string;
  name: string;
  nameBn: string | null;
  slug: string;
  href: string;
  subtitle: string | null;
  imageUrl: string | null;
  iconUrl: string | null;
  /** A lucide icon name; the navigation rail falls back to it when there is no
   * uploaded artwork. */
  icon: string | null;
  productCount: number;
  depth: number;
  children: NavCategory[];
}

export function toNavCategory(node: CategoryNode): NavCategory {
  return {
    id: node.id,
    name: node.name,
    nameBn: node.nameBn,
    slug: node.slug,
    href: node.href,
    subtitle: node.subtitle,
    imageUrl: node.imageUrl,
    iconUrl: node.iconUrl,
    icon: node.icon,
    productCount: node.totalProductCount,
    depth: node.depth,
    children: node.children.map(toNavCategory),
  };
}

/** The navigation tree: departments flagged "show in navigation", each with the
 * two levels beneath it. */
export async function getNavigationCategories(limit = 12): Promise<NavCategory[]> {
  return (await getNavigationTree(limit)).map(toNavCategory);
}

/** A category and everything beneath it, which is what a listing page means by
 * "in this category". */
export function collectDescendantIds(node: CategoryNode): string[] {
  const ids = [node.id];
  for (const child of node.children) ids.push(...collectDescendantIds(child));
  return ids;
}

export async function getCategoryScopeIds(slugOrId: string): Promise<string[]> {
  const node = await getCategoryBySlug(slugOrId);
  return node ? collectDescendantIds(node) : [];
}

/** Breadcrumb trail for a category page, ending with the category itself. */
export function breadcrumbFor(node: CategoryNode): { name: string; href: string }[] {
  return [...node.ancestors.map((a) => ({ name: a.name, href: a.href })), { name: node.name, href: node.href }];
}

/* -------------------------------------------------------------------------- */
/* Validation                                                                 */
/* -------------------------------------------------------------------------- */

export function slugify(value: string): string {
  return (
    value
      .toLowerCase()
      .normalize("NFKD")
      // Bangla names transliterate to nothing, so a slug derived from one would
      // be empty; the caller falls back to a generated one in that case.
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, MAX_SLUG_LENGTH)
  );
}

function requireName(value: string): string {
  const name = value.trim();
  if (!name) throw new CategoryError("Enter a category name.");
  if (name.length > MAX_NAME_LENGTH) {
    throw new CategoryError(`Keep the name under ${MAX_NAME_LENGTH} characters.`);
  }
  return name;
}

/** Refuses a slug already in use. The table has a UNIQUE constraint too -- this
 * exists so the admin gets "that slug is taken" rather than a raw SQL error. */
async function resolveSlug(
  requested: string,
  fallbackFrom: string,
  exceptId: string | null
): Promise<string> {
  const base = slugify(requested) || slugify(fallbackFrom) || `category-${crypto.randomUUID().slice(0, 8)}`;
  const db = await getDB();

  const taken = async (candidate: string) =>
    Boolean(
      await db
        .prepare("SELECT id FROM categories WHERE slug = ? AND id != ?")
        .bind(candidate, exceptId ?? "")
        .first<{ id: string }>()
    );

  // An explicitly typed slug is a promise the admin made about their URLs, so a
  // clash is reported rather than silently suffixed. A slug derived from the
  // name is not, so it gets the next free suffix.
  if (slugify(requested)) {
    if (await taken(base)) throw new CategoryError(`The slug "${base}" is already in use.`);
    return base;
  }

  let candidate = base;
  for (let attempt = 2; attempt < 100; attempt += 1) {
    if (!(await taken(candidate))) return candidate;
    candidate = `${base}-${attempt}`;
  }
  return `${base}-${crypto.randomUUID().slice(0, 6)}`;
}

/** Validates a move and returns the depth the category would end up at.
 *
 * Three ways a parent can be wrong, all checked here rather than in the form:
 * it may not exist, it may be the category itself or one of its own
 * descendants (which detaches the whole subtree from the tree and leaves an
 * unreachable cycle), and it may already be deep enough that the subtree would
 * overflow MAX_DEPTH. */
async function assignParent(
  categoryId: string | null,
  parentId: string | null
): Promise<{ parentId: string | null; depth: number }> {
  if (!parentId) return { parentId: null, depth: 1 };

  const index = await getAdminCategoryIndex();
  const parent = index.byId.get(parentId);
  if (!parent) throw new CategoryError("That parent category no longer exists.");

  if (categoryId) {
    if (parentId === categoryId) {
      throw new CategoryError("A category cannot be its own parent.");
    }
    const self = index.byId.get(categoryId);
    if (self && collectDescendantIds(self).includes(parentId)) {
      throw new CategoryError("That parent sits inside this category — the tree would loop.");
    }
  }

  const depth = parent.depth + 1;
  if (depth > MAX_DEPTH) {
    throw new CategoryError(
      `Categories go ${MAX_DEPTH} levels deep. "${parent.name}" is already at level ${parent.depth}.`
    );
  }

  // Moving a branch takes its children along, so the *deepest* leaf is what has
  // to fit, not the category being moved.
  if (categoryId) {
    const self = index.byId.get(categoryId);
    if (self) {
      const ownHeight = subtreeHeight(self);
      if (depth + ownHeight - 1 > MAX_DEPTH) {
        throw new CategoryError(
          `Moving "${self.name}" there would push its subcategories past level ${MAX_DEPTH}.`
        );
      }
    }
  }

  return { parentId, depth };
}

function subtreeHeight(node: CategoryNode): number {
  if (node.children.length === 0) return 1;
  return 1 + Math.max(...node.children.map(subtreeHeight));
}

/* -------------------------------------------------------------------------- */
/* Mutations                                                                  */
/* -------------------------------------------------------------------------- */

export interface CategoryInput {
  name: string;
  nameBn?: string | null;
  slug?: string | null;
  parentId?: string | null;
  subtitle?: string | null;
  descriptionEn?: string | null;
  descriptionBn?: string | null;
  imageUrl?: string | null;
  iconUrl?: string | null;
  icon?: string | null;
  sortOrder?: number;
  isActive?: boolean;
  isFeatured?: boolean;
  showOnHomepage?: boolean;
  showInNavigation?: boolean;
  seoTitle?: string | null;
  seoDescription?: string | null;
}

const blank = (value: string | null | undefined): string | null => {
  const trimmed = (value ?? "").trim();
  return trimmed === "" ? null : trimmed;
};

/** CREATE category. */
export async function createCategory(input: CategoryInput): Promise<CategoryNode> {
  const name = requireName(input.name);
  const { parentId } = await assignParent(null, blank(input.parentId));
  const slug = await resolveSlug(input.slug ?? "", name, null);

  const db = await getDB();
  const id = crypto.randomUUID();

  // A new category lands at the end of its level unless the admin said where.
  const sortOrder =
    typeof input.sortOrder === "number" && Number.isFinite(input.sortOrder)
      ? Math.trunc(input.sortOrder)
      : await nextSortOrder(parentId);

  await db
    .prepare(
      `INSERT INTO categories (id, parent_id, name, name_en, name_bn, slug, subtitle,
                               description_en, description_bn, image_url, icon, icon_url,
                               sort_order, is_active, is_featured, show_on_homepage,
                               show_in_navigation, seo_title, seo_description, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`
    )
    .bind(
      id,
      parentId,
      name,
      name,
      blank(input.nameBn),
      slug,
      blank(input.subtitle),
      blank(input.descriptionEn),
      blank(input.descriptionBn),
      blank(input.imageUrl),
      blank(input.icon),
      blank(input.iconUrl),
      sortOrder,
      input.isActive === false ? 0 : 1,
      input.isFeatured ? 1 : 0,
      input.showOnHomepage === false ? 0 : 1,
      input.showInNavigation === false ? 0 : 1,
      blank(input.seoTitle),
      blank(input.seoDescription)
    )
    .run();

  await invalidateCatalog();

  const created = (await getAdminCategoryIndex()).byId.get(id);
  if (!created) throw new CategoryError("The category could not be created.");
  return created;
}

async function nextSortOrder(parentId: string | null): Promise<number> {
  const db = await getDB();
  const row = await db
    .prepare(
      parentId
        ? "SELECT COALESCE(MAX(sort_order), -1) AS top FROM categories WHERE parent_id = ?"
        : "SELECT COALESCE(MAX(sort_order), -1) AS top FROM categories WHERE parent_id IS NULL"
    )
    .bind(...(parentId ? [parentId] : []))
    .first<{ top: number }>();

  return (row?.top ?? -1) + 1;
}

/** UPDATE category. Only the keys present in `input` are written, so a screen
 * that edits one toggle cannot blank the fields it never showed. */
export async function updateCategory(id: string, input: Partial<CategoryInput>): Promise<void> {
  const index = await getAdminCategoryIndex();
  const existing = index.byId.get(id);
  if (!existing) throw new CategoryError("That category no longer exists.");

  const sets: string[] = [];
  const binds: unknown[] = [];
  const set = (column: string, value: unknown) => {
    sets.push(`${column} = ?`);
    binds.push(value);
  };

  if (input.name !== undefined) {
    const name = requireName(input.name);
    set("name", name);
    set("name_en", name);
  }
  if (input.nameBn !== undefined) set("name_bn", blank(input.nameBn));

  if (input.parentId !== undefined) {
    const { parentId } = await assignParent(id, blank(input.parentId));
    set("parent_id", parentId);
    // A category changing level starts at the end of its new level rather than
    // landing on whatever position it happened to hold in the old one.
    if (parentId !== existing.parentId && input.sortOrder === undefined) {
      set("sort_order", await nextSortOrder(parentId));
    }
  }

  // A renamed category keeps its slug unless the slug itself was edited: the
  // old URL is in search results and in people's history.
  if (input.slug !== undefined && blank(input.slug) !== existing.slug) {
    set("slug", await resolveSlug(input.slug ?? "", input.name ?? existing.name, id));
  }

  if (input.subtitle !== undefined) set("subtitle", blank(input.subtitle));
  if (input.descriptionEn !== undefined) set("description_en", blank(input.descriptionEn));
  if (input.descriptionBn !== undefined) set("description_bn", blank(input.descriptionBn));
  if (input.imageUrl !== undefined) set("image_url", blank(input.imageUrl));
  if (input.iconUrl !== undefined) set("icon_url", blank(input.iconUrl));
  if (input.icon !== undefined) set("icon", blank(input.icon));
  if (input.seoTitle !== undefined) set("seo_title", blank(input.seoTitle));
  if (input.seoDescription !== undefined) set("seo_description", blank(input.seoDescription));

  if (input.sortOrder !== undefined && Number.isFinite(input.sortOrder)) {
    set("sort_order", Math.trunc(input.sortOrder));
  }
  if (input.isActive !== undefined) set("is_active", input.isActive ? 1 : 0);
  if (input.isFeatured !== undefined) set("is_featured", input.isFeatured ? 1 : 0);
  if (input.showOnHomepage !== undefined) set("show_on_homepage", input.showOnHomepage ? 1 : 0);
  if (input.showInNavigation !== undefined) {
    set("show_in_navigation", input.showInNavigation ? 1 : 0);
  }

  if (sets.length === 0) return;

  const db = await getDB();
  await db
    .prepare(`UPDATE categories SET ${sets.join(", ")}, updated_at = datetime('now') WHERE id = ?`)
    .bind(...binds, id)
    .run();

  await invalidateCatalog();
}

/** Visibility cascades in both directions.
 *
 * Hiding a parent has to hide everything beneath it, or a "hidden" department
 * stays reachable through its own subcategories. Showing it again has to bring
 * them back for the same reason read the other way: a department whose children
 * are all still hidden renders as an empty page with no products and nothing to
 * click, and no amount of looking at that department's own row explains why.
 *
 * The cost is that a subcategory hidden deliberately comes back when its parent
 * is toggled. That is visible in the tree the moment it happens and is trivially
 * undone; a department that is silently empty is neither. */
export async function setCategoryActive(id: string, active: boolean): Promise<void> {
  const index = await getAdminCategoryIndex();
  const node = index.byId.get(id);
  if (!node) throw new CategoryError("That category no longer exists.");

  const db = await getDB();
  const ids = collectDescendantIds(node);
  const placeholders = ids.map(() => "?").join(",");

  await db
    .prepare(
      `UPDATE categories SET is_active = ?, updated_at = datetime('now')
        WHERE id IN (${placeholders})`
    )
    .bind(active ? 1 : 0, ...ids)
    .run();

  await invalidateCatalog();
}

export interface DeletionCheck {
  canDelete: boolean;
  childCount: number;
  /** Products whose *primary* category this is -- they would be left
   * uncategorised, so they have to be moved first. */
  primaryProductCount: number;
  /** Products merely cross-listed here; the link goes, the product stays. */
  linkedProductCount: number;
  reason: string | null;
}

/** What stands between a category and deletion. The admin UI shows this before
 * offering the button; `deleteCategory` re-runs it regardless. */
export async function checkCategoryDeletion(id: string): Promise<DeletionCheck> {
  const db = await getDB();

  const counts = await db
    .prepare(
      `SELECT (SELECT COUNT(*) FROM categories WHERE parent_id = ?) AS children,
              (SELECT COUNT(*) FROM products WHERE category_id = ?) AS primary_products,
              (SELECT COUNT(*) FROM product_categories
                WHERE category_id = ? AND is_primary = 0) AS linked_products`
    )
    .bind(id, id, id)
    .first<{ children: number; primary_products: number; linked_products: number }>();

  const childCount = counts?.children ?? 0;
  const primaryProductCount = counts?.primary_products ?? 0;
  const linkedProductCount = counts?.linked_products ?? 0;

  let reason: string | null = null;
  if (childCount > 0) {
    reason = `It still has ${childCount} subcategor${childCount === 1 ? "y" : "ies"}. Move or delete them first.`;
  } else if (primaryProductCount > 0) {
    reason = `${primaryProductCount} product${primaryProductCount === 1 ? " is" : "s are"} filed here. Choose a category to move ${primaryProductCount === 1 ? "it" : "them"} to.`;
  }

  return {
    canDelete: reason === null,
    childCount,
    primaryProductCount,
    linkedProductCount,
    reason,
  };
}

/** DELETE category safely.
 *
 * Products are never deleted with a category. When products are filed here, the
 * caller must name where they go; without that the delete is refused rather
 * than silently un-categorising them, which is what the schema's ON DELETE SET
 * NULL would otherwise do. */
export async function deleteCategory(
  id: string,
  options: { reassignTo?: string | null } = {}
): Promise<void> {
  const index = await getAdminCategoryIndex();
  const node = index.byId.get(id);
  if (!node) throw new CategoryError("That category no longer exists.");

  const check = await checkCategoryDeletion(id);

  if (check.childCount > 0) {
    throw new CategoryError(check.reason ?? "This category still has subcategories.");
  }

  const db = await getDB();
  const statements = [];

  if (check.primaryProductCount > 0) {
    const target = options.reassignTo?.trim() || null;
    if (!target) {
      throw new CategoryError(check.reason ?? "This category still holds products.");
    }
    if (target === id) {
      throw new CategoryError("Pick a different category to move the products to.");
    }
    if (!index.byId.has(target)) {
      throw new CategoryError("That destination category no longer exists.");
    }

    statements.push(
      db
        .prepare(
          "UPDATE products SET category_id = ?, updated_at = datetime('now') WHERE category_id = ?"
        )
        .bind(target, id),
      // The cross-listing table follows the move. `OR REPLACE` covers a product
      // already cross-listed in the destination, which would otherwise collide
      // with the primary-key pair.
      db
        .prepare(
          `INSERT OR REPLACE INTO product_categories (product_id, category_id, is_primary)
           SELECT product_id, ?, is_primary FROM product_categories WHERE category_id = ?`
        )
        .bind(target, id)
    );
  }

  // Remaining links are cross-listings only; dropping them un-files the product
  // from this category and leaves the product itself untouched.
  statements.push(
    db.prepare("DELETE FROM product_categories WHERE category_id = ?").bind(id),
    db.prepare("DELETE FROM categories WHERE id = ?").bind(id)
  );

  await db.batch(statements);
  await invalidateCatalog();
}

/** REORDER categories. The ids are the new order of one level; positions are
 * written as 0..n so a later insert has room at the end.
 *
 * Ids that do not belong to `parentId` are ignored rather than moved, so a
 * tampered drag payload cannot re-parent a category through this path. */
export async function reorderCategories(
  parentId: string | null,
  orderedIds: string[]
): Promise<void> {
  const index = await getAdminCategoryIndex();
  const siblings = new Set(
    index.all.filter((node) => node.parentId === (parentId ?? null)).map((node) => node.id)
  );

  const valid = orderedIds.filter((id) => siblings.has(id));
  if (valid.length === 0) return;

  const db = await getDB();
  await db.batch(
    valid.map((id, position) =>
      db
        .prepare("UPDATE categories SET sort_order = ?, updated_at = datetime('now') WHERE id = ?")
        .bind(position, id)
    )
  );

  await invalidateCatalog();
}

/* -------------------------------------------------------------------------- */
/* Product <-> category links                                                 */
/* -------------------------------------------------------------------------- */

/** Keeps `product_categories` in step with a product's primary category.
 *
 * `products.category_id` stays the primary category -- it is what the product
 * form, the catalog queries and the order reports read -- and this mirrors it
 * into the link table so a listing page can match on one table. Extra
 * categories passed in are added as non-primary links; passing none leaves any
 * existing cross-listings alone.
 *
 * Called from the product server actions inside the same request as the write,
 * not on a schedule, so the two can never be observed out of step. */
export async function syncProductCategories(
  productId: string,
  primaryCategoryId: string | null,
  extraCategoryIds: string[] = []
): Promise<void> {
  const db = await getDB();
  const statements = [];

  // Demote whatever was primary before; there is a unique index on one primary
  // per product, so the old row has to go first.
  statements.push(
    db
      .prepare("DELETE FROM product_categories WHERE product_id = ? AND is_primary = 1")
      .bind(productId)
  );

  if (primaryCategoryId) {
    statements.push(
      db
        .prepare(
          `INSERT OR REPLACE INTO product_categories (product_id, category_id, is_primary)
           VALUES (?, ?, 1)`
        )
        .bind(productId, primaryCategoryId)
    );
  }

  for (const categoryId of new Set(extraCategoryIds.filter(Boolean))) {
    if (categoryId === primaryCategoryId) continue;
    statements.push(
      db
        .prepare(
          `INSERT OR IGNORE INTO product_categories (product_id, category_id, is_primary)
           VALUES (?, ?, 0)`
        )
        .bind(productId, categoryId)
    );
  }

  await db.batch(statements);
}
