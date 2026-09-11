
/** What an option *is*, with nothing that touches the database.
 *
 * The admin builder runs in the browser and needs the same limits, the same
 * slug rules and the same idea of a combination signature that the server uses.
 * Keeping them here means there is one definition of each rather than two that
 * can drift -- and it keeps `cloudflare:workers`, which `./db` pulls in, out of
 * the client bundle.
 *
 * The half that reads and writes lives in `./productOptions`.
 *
 * Two representations of the same thing exist in the schema. The canonical one
 * -- `product_option_groups` / `product_option_values` /
 * `product_variant_options` -- is what `/products/<slug>` reads. The older
 * two-slot one -- `product_variants.option1_*` / `option2_*` / `swatch` -- is
 * what `/product/<id>` reads. `planOptions` below decides both at once.
 */

export type OptionDisplay = "swatch" | "image" | "pill" | "dropdown";

/** Caps. Generous enough for a phone (Colour × Storage × Carrier) and small
 * enough that one save stays inside a single batch. */
export const MAX_GROUPS = 5;
export const MAX_VALUES_PER_GROUP = 30;
export const MAX_VARIANTS = 200;

/** The legacy page draws `option1_value` as a colour swatch and `option2_value`
 * as a size, and cannot render anything else. So only these two groups are
 * mirrored; a Volume or Storage group is left out of the legacy slots rather
 * than being written there as a wrong value. */
const LEGACY_COLOR_KEY = "color";
const LEGACY_SIZE_KEY = "size";

/* -------------------------------------------------------------------------- */
/* What the form posts                                                        */
/* -------------------------------------------------------------------------- */

export interface OptionValueInput {
  /** Stable only within one submission; how variants name their selection. */
  ref: string;
  /** An existing `product_option_values.id`, or null for a new value. */
  id: string | null;
  label: string;
  colorHex: string | null;
  imageUrl: string | null;
  isActive: boolean;
}

export interface OptionGroupInput {
  ref: string;
  id: string | null;
  name: string;
  display: OptionDisplay;
  showLabels: boolean;
  isActive: boolean;
  values: OptionValueInput[];
}

export interface VariantInput {
  /** group ref -> value ref. */
  selections: Record<string, string>;
  sku: string | null;
  price: number | null;
  oldPrice: number | null;
  /** null means "leave whatever is stored alone" -- an untouched cell must not
   * silently reset a real stock figure to zero. */
  stock: number | null;
  lowStockThreshold: number | null;
  /** A URL from this product's own gallery; resolved to an image id. */
  imageUrl: string | null;
  isActive: boolean;
}

export interface OptionsInput {
  groups: OptionGroupInput[];
  variants: VariantInput[];
}

/** A validation failure the admin can fix, as opposed to a bug. */
export class OptionValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OptionValidationError";
  }
}

/* -------------------------------------------------------------------------- */
/* Reading what the form posted                                               */
/* -------------------------------------------------------------------------- */

function asString(value: unknown, field: string, max: number): string {
  if (typeof value !== "string") throw new OptionValidationError(`${field} is missing.`);
  const trimmed = value.trim();
  if (trimmed.length > max) throw new OptionValidationError(`${field} is too long.`);
  return trimmed;
}

function asOptionalString(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, max);
}

function asWholeNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = typeof value === "number" ? value : Number.parseInt(String(value), 10);
  if (!Number.isFinite(parsed)) return null;
  return Math.trunc(parsed);
}

const DISPLAYS: OptionDisplay[] = ["swatch", "image", "pill", "dropdown"];

/** Parses the one hidden field the builder posts.
 *
 * A comma-separated string cannot describe five groups with their values and
 * two hundred variant rows, so the builder posts JSON and everything in it is
 * treated as untrusted: types, lengths and counts are all checked here, and
 * prices, stock and the combination signature are recomputed on the server
 * regardless of what arrived. */
export function parseOptionsPayload(raw: unknown): OptionsInput {
  if (typeof raw !== "string" || !raw.trim()) return { groups: [], variants: [] };

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new OptionValidationError("The options could not be read. Reload the page and try again.");
  }

  const payload = parsed as { groups?: unknown; variants?: unknown };
  const rawGroups = Array.isArray(payload.groups) ? payload.groups : [];
  const rawVariants = Array.isArray(payload.variants) ? payload.variants : [];

  if (rawGroups.length > MAX_GROUPS) {
    throw new OptionValidationError(`A product can have at most ${MAX_GROUPS} option groups.`);
  }
  if (rawVariants.length > MAX_VARIANTS) {
    throw new OptionValidationError(
      `That is ${rawVariants.length} combinations; the limit is ${MAX_VARIANTS}. Use fewer option values.`
    );
  }

  const groups: OptionGroupInput[] = rawGroups.map((entry, index) => {
    const group = entry as Record<string, unknown>;
    const name = asString(group.name, `Option ${index + 1} name`, 40);
    if (!name) throw new OptionValidationError(`Option ${index + 1} needs a name.`);

    const rawValues = Array.isArray(group.values) ? group.values : [];
    if (rawValues.length > MAX_VALUES_PER_GROUP) {
      throw new OptionValidationError(
        `"${name}" has ${rawValues.length} values; the limit is ${MAX_VALUES_PER_GROUP}.`
      );
    }

    const values: OptionValueInput[] = rawValues.map((valueEntry, valueIndex) => {
      const value = valueEntry as Record<string, unknown>;
      const label = asString(value.label, `Value ${valueIndex + 1} of "${name}"`, 60);
      if (!label) throw new OptionValidationError(`A value in "${name}" has no name.`);
      return {
        ref: asString(value.ref, "value ref", 64),
        id: asOptionalString(value.id, 64),
        label,
        colorHex: asOptionalString(value.colorHex, 120),
        imageUrl: asOptionalString(value.imageUrl, 500),
        isActive: value.isActive !== false,
      };
    });

    const display = DISPLAYS.includes(group.display as OptionDisplay)
      ? (group.display as OptionDisplay)
      : "pill";

    return {
      ref: asString(group.ref, "group ref", 64),
      id: asOptionalString(group.id, 64),
      name,
      display,
      showLabels: group.showLabels !== false,
      isActive: group.isActive !== false,
      values,
    };
  });

  const variants: VariantInput[] = rawVariants.map((entry) => {
    const variant = entry as Record<string, unknown>;
    const selections: Record<string, string> = {};
    const rawSelections = (variant.selections ?? {}) as Record<string, unknown>;
    for (const [groupRef, valueRef] of Object.entries(rawSelections)) {
      if (typeof valueRef === "string") selections[groupRef] = valueRef;
    }
    return {
      selections,
      sku: asOptionalString(variant.sku, 60),
      price: asWholeNumber(variant.price),
      oldPrice: asWholeNumber(variant.oldPrice),
      stock: asWholeNumber(variant.stock),
      lowStockThreshold: asWholeNumber(variant.lowStockThreshold),
      imageUrl: asOptionalString(variant.imageUrl, 500),
      isActive: variant.isActive !== false,
    };
  });

  return { groups, variants };
}

/* -------------------------------------------------------------------------- */
/* Keys and signatures                                                        */
/* -------------------------------------------------------------------------- */

/** The url-safe form of a name, used for a group key and a value slug.
 *
 * A key is derived once, when the group is created, and then left alone:
 * renaming "Color" to "Colour" must not change the key, because the key is
 * half of every variant signature and is what decides whether the group is
 * mirrored into the legacy colour slot. */
export function slugifyOption(value: string): string {
  const slug = value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "option";
}

/** `<group key>=<value id>` pairs sorted by key and joined with `|`, matching
 * what migration 0013 computed in SQL. Empty for a variant with no options. */
export function computeSignature(pairs: { groupKey: string; valueId: string }[]): string {
  return [...pairs]
    .sort((a, b) => (a.groupKey < b.groupKey ? -1 : a.groupKey > b.groupKey ? 1 : 0))
    .map((pair) => `${pair.groupKey}=${pair.valueId}`)
    .join("|");
}

function uniqueKey(base: string, taken: Set<string>): string {
  if (!taken.has(base)) {
    taken.add(base);
    return base;
  }
  for (let suffix = 2; suffix < 100; suffix += 1) {
    const candidate = `${base}-${suffix}`;
    if (!taken.has(candidate)) {
      taken.add(candidate);
      return candidate;
    }
  }
  throw new OptionValidationError(`Too many options named like "${base}".`);
}

/* -------------------------------------------------------------------------- */
/* The product as it stands today                                             */
/* -------------------------------------------------------------------------- */

export interface CurrentGroup {
  id: string;
  key: string;
  name: string;
  sortOrder: number;
}

export interface CurrentValue {
  id: string;
  groupId: string;
  value: string;
}

export interface CurrentVariant {
  id: string;
  sku: string | null;
  signature: string;
  stockQuantity: number;
  isActive: boolean;
}

export interface CurrentState {
  groups: CurrentGroup[];
  values: CurrentValue[];
  variants: CurrentVariant[];
}

export const EMPTY_STATE: CurrentState = { groups: [], values: [], variants: [] };

/* -------------------------------------------------------------------------- */
/* The plan                                                                   */
/* -------------------------------------------------------------------------- */

export interface PlannedGroup {
  id: string;
  key: string;
  name: string;
  display: OptionDisplay;
  showLabels: boolean;
  isActive: boolean;
  sortOrder: number;
  isNew: boolean;
}

export interface PlannedValue {
  id: string;
  groupId: string;
  value: string;
  label: string;
  colorHex: string | null;
  imageUrl: string | null;
  isActive: boolean;
  sortOrder: number;
  isNew: boolean;
}

export interface PlannedVariant {
  id: string;
  isNew: boolean;
  signature: string;
  links: { groupId: string; valueId: string }[];
  sku: string | null;
  price: number | null;
  oldPrice: number | null;
  lowStockThreshold: number;
  imageId: string | null;
  isActive: boolean;
  legacy: {
    option1Name: string | null;
    option1Value: string | null;
    option2Name: string | null;
    option2Value: string | null;
    swatch: string | null;
  };
  /** Absolute figure the admin asked for, or null to leave stock alone. */
  stockTarget: number | null;
  stockCurrent: number;
}

export interface OptionPlan {
  groups: PlannedGroup[];
  values: PlannedValue[];
  variants: PlannedVariant[];
  /** Existing rows that are no longer offered. Retired, never removed. */
  retireGroupIds: string[];
  retireValueIds: string[];
  retireVariantIds: string[];
  /** Every SKU the plan wants, for the global uniqueness check. */
  skuClaims: { sku: string; variantId: string }[];
}

/** Works out the whole change without touching the database.
 *
 * Everything that decides what gets written lives here so it can be reasoned
 * about and tested directly: which rows are new, which are reused, which are
 * retired, what each variant's signature and legacy mirror are, and how much
 * stock has to move. */
export function planOptions(
  current: CurrentState,
  input: OptionsInput,
  imageIdByUrl: Map<string, string>
): OptionPlan {
  const takenKeys = new Set<string>();
  const currentGroupById = new Map(current.groups.map((group) => [group.id, group]));
  const currentValueById = new Map(current.values.map((value) => [value.id, value]));

  /* ---- groups -------------------------------------------------------- */

  const groups: PlannedGroup[] = [];
  const groupByRef = new Map<string, PlannedGroup>();
  const seenNames = new Set<string>();

  input.groups.forEach((group, index) => {
    const lowerName = group.name.toLowerCase();
    if (seenNames.has(lowerName)) {
      throw new OptionValidationError(`Two option groups are both called "${group.name}".`);
    }
    seenNames.add(lowerName);

    const existing = group.id ? currentGroupById.get(group.id) : undefined;
    // An existing group keeps the key it was created with. The key is half of
    // every variant signature and decides the legacy mirror, so a rename must
    // not move it.
    const key = existing ? existing.key : uniqueKey(slugifyOption(group.name), takenKeys);
    if (existing) takenKeys.add(existing.key);

    const planned: PlannedGroup = {
      id: existing?.id ?? crypto.randomUUID(),
      key,
      name: group.name,
      display: group.display,
      showLabels: group.showLabels,
      isActive: group.isActive,
      sortOrder: index,
      isNew: !existing,
    };
    groups.push(planned);
    groupByRef.set(group.ref, planned);
  });

  /* ---- values -------------------------------------------------------- */

  const values: PlannedValue[] = [];
  const valueByRef = new Map<string, PlannedValue>();

  input.groups.forEach((group) => {
    const plannedGroup = groupByRef.get(group.ref)!;
    const takenSlugs = new Set<string>(
      current.values.filter((v) => v.groupId === plannedGroup.id).map((v) => v.value)
    );
    const seenLabels = new Set<string>();

    group.values.forEach((value, index) => {
      const lowerLabel = value.label.toLowerCase();
      if (seenLabels.has(lowerLabel)) {
        throw new OptionValidationError(
          `"${group.name}" lists "${value.label}" twice.`
        );
      }
      seenLabels.add(lowerLabel);

      const existing = value.id ? currentValueById.get(value.id) : undefined;
      // Same reasoning as the group key: the slug is created once so that
      // renaming a label cannot invalidate anything pointing at it.
      const slug = existing ? existing.value : uniqueKey(slugifyOption(value.label), takenSlugs);

      const planned: PlannedValue = {
        id: existing?.id ?? crypto.randomUUID(),
        groupId: plannedGroup.id,
        value: slug,
        label: value.label,
        colorHex: value.colorHex,
        imageUrl: value.imageUrl,
        // A value inside a retired group is not offered either way; keeping its
        // own flag means re-activating the group restores exactly what was on.
        isActive: value.isActive,
        sortOrder: index,
        isNew: !existing,
      };
      values.push(planned);
      valueByRef.set(value.ref, planned);
    });
  });

  /* ---- the combinations the options imply ----------------------------- */

  const activeGroups = groups.filter((group) => group.isActive);
  const activeValuesByGroup = new Map<string, PlannedValue[]>(
    activeGroups.map((group) => [
      group.id,
      values.filter((value) => value.groupId === group.id && value.isActive),
    ])
  );

  for (const group of activeGroups) {
    if ((activeValuesByGroup.get(group.id) ?? []).length === 0) {
      throw new OptionValidationError(`"${group.name}" has no active values. Add one or turn the option off.`);
    }
  }

  const expectedCount = activeGroups.reduce(
    (total, group) => total * (activeValuesByGroup.get(group.id) ?? []).length,
    1
  );
  if (expectedCount > MAX_VARIANTS) {
    throw new OptionValidationError(
      `Those options make ${expectedCount} combinations; the limit is ${MAX_VARIANTS}.`
    );
  }

  /* ---- variants ------------------------------------------------------- */

  const colorGroup = activeGroups.find((group) => group.key === LEGACY_COLOR_KEY);
  const sizeGroup = activeGroups.find((group) => group.key === LEGACY_SIZE_KEY);

  const variantBySignature = new Map<string, CurrentVariant>();
  for (const variant of current.variants) variantBySignature.set(variant.signature, variant);

  const variants: PlannedVariant[] = [];
  const claimedSignatures = new Set<string>();
  const skuClaims: { sku: string; variantId: string }[] = [];
  const seenSkus = new Map<string, string>();

  for (const entry of input.variants) {
    const links: { groupId: string; valueId: string }[] = [];
    const pairs: { groupKey: string; valueId: string }[] = [];
    let colorValue: PlannedValue | undefined;
    let sizeValue: PlannedValue | undefined;

    for (const group of activeGroups) {
      const groupInput = input.groups.find((candidate) => groupByRef.get(candidate.ref) === group)!;
      const valueRef = entry.selections[groupInput.ref];
      const value = valueRef ? valueByRef.get(valueRef) : undefined;

      if (!value || value.groupId !== group.id || !value.isActive) {
        throw new OptionValidationError(
          `A combination is missing a valid "${group.name}". Reload the page and try again.`
        );
      }
      links.push({ groupId: group.id, valueId: value.id });
      pairs.push({ groupKey: group.key, valueId: value.id });
      if (group === colorGroup) colorValue = value;
      if (group === sizeGroup) sizeValue = value;
    }

    // The signature is computed here, never taken from the browser.
    const signature = computeSignature(pairs);
    if (claimedSignatures.has(signature)) {
      throw new OptionValidationError(
        "The same combination appears twice. Reload the page and try again."
      );
    }
    claimedSignatures.add(signature);

    const existing = variantBySignature.get(signature);
    const sku = entry.sku;
    if (sku) {
      const owner = seenSkus.get(sku.toLowerCase());
      if (owner) throw new OptionValidationError(`The SKU "${sku}" is used by two combinations.`);
      seenSkus.set(sku.toLowerCase(), sku);
    }

    const price = entry.price !== null && entry.price > 0 ? entry.price : null;
    const oldPrice = entry.oldPrice !== null && entry.oldPrice > 0 ? entry.oldPrice : null;
    if (price !== null && oldPrice !== null && oldPrice <= price) {
      throw new OptionValidationError(
        "A compare-at price has to be higher than the price it is compared with."
      );
    }

    const variantId = existing?.id ?? crypto.randomUUID();
    if (sku) skuClaims.push({ sku, variantId });

    variants.push({
      id: variantId,
      isNew: !existing,
      signature,
      links,
      sku,
      price,
      oldPrice,
      lowStockThreshold: Math.max(0, entry.lowStockThreshold ?? 5),
      imageId: entry.imageUrl ? (imageIdByUrl.get(entry.imageUrl) ?? null) : null,
      isActive: entry.isActive,
      legacy: {
        option1Name: colorValue ? (colorGroup?.name ?? null) : null,
        option1Value: colorValue?.label ?? null,
        option2Name: sizeValue ? (sizeGroup?.name ?? null) : null,
        option2Value: sizeValue?.label ?? null,
        swatch: colorValue?.colorHex ?? null,
      },
      stockTarget: entry.stock === null ? null : Math.max(0, entry.stock),
      stockCurrent: existing?.stockQuantity ?? 0,
    });
  }

  if (variants.length !== expectedCount) {
    throw new OptionValidationError(
      `Expected ${expectedCount} combinations but got ${variants.length}. Reload the page and try again.`
    );
  }
  if (variants.length === 0) {
    throw new OptionValidationError("A product needs at least one sellable combination.");
  }
  if (!variants.some((variant) => variant.isActive)) {
    throw new OptionValidationError("At least one combination has to stay active to be sellable.");
  }

  /* ---- what is no longer offered -------------------------------------- */

  const keptGroupIds = new Set(groups.map((group) => group.id));
  const keptValueIds = new Set(values.map((value) => value.id));
  const keptVariantIds = new Set(variants.map((variant) => variant.id));

  return {
    groups,
    values,
    variants,
    retireGroupIds: current.groups.filter((g) => !keptGroupIds.has(g.id)).map((g) => g.id),
    retireValueIds: current.values.filter((v) => !keptValueIds.has(v.id)).map((v) => v.id),
    // Retired, not removed: the row keeps its stock, SKU, price and its place
    // in the ledger, so re-adding the combination brings all of it back.
    retireVariantIds: current.variants
      .filter((v) => !keptVariantIds.has(v.id) && v.isActive)
      .map((v) => v.id),
    skuClaims,
  };
}

