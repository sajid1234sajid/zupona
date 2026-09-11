import { getDB } from "./db";
import { stockChangeStatements } from "./inventory";
import {
  EMPTY_STATE,
  OptionValidationError,
  planOptions,
  type CurrentState,
  type OptionPlan,
  type OptionsInput,
} from "./optionModel";

export * from "./optionModel";

/** Options and variants, written in one place.
 *
 * Nothing else in the app writes `product_option_groups`,
 * `product_option_values`, `product_variant_options` or `product_variants`.
 * Two representations of the same thing exist in the schema -- the canonical
 * tables the new product page reads, and the older `option1_*` / `option2_*`
 * slots the legacy page reads -- and nothing kept them in step, which is why a
 * product added through the admin panel used to reach the new page with no
 * selectors at all. Every save here writes both.
 *
 * The shape of a save is deliberate:
 *
 *   1. read the product's current options and variants
 *   2. plan the whole change as data, with no I/O  (`planOptions`, pure)
 *   3. hand the caller one ordered list of statements -- structure, legacy
 *      mirror, quantities and ledger rows alike -- for its own `db.batch()`
 *
 * There is no step 4. An earlier version moved stock after the batch had
 * committed, on the belief that a ledger row could only be written by calling
 * into `inventory.ts`. That was wrong: a stock change there is already a pair
 * of statements, and `stockChangeStatements` now hands that same pair over to
 * be run anywhere. So one save is one transaction. A product's structure, its
 * prices, its quantities and the ledger rows explaining them all land together
 * or none of them do, and a half-applied inventory state is not a thing that
 * can happen.
 *
 * A variant is never deleted: `inventory_movements.variant_id` cascades, so a
 * `DELETE` would erase the history of what was sold. Retiring a combination
 * sets `is_active = 0` and changes nothing else -- not its stock, not its
 * reservations, not its SKU or price -- and writes no ledger row. That is a
 * sellability change, not a stock movement, and re-activating the same
 * combination brings the row back exactly as it was.
 */

async function readCurrentState(productId: string): Promise<CurrentState> {
  const db = await getDB();
  const [groups, values, variants] = await db.batch<Record<string, unknown>>([
    db
      .prepare(
        "SELECT id, key, name, sort_order FROM product_option_groups WHERE product_id = ? ORDER BY sort_order ASC"
      )
      .bind(productId),
    db
      .prepare(
        `SELECT ov.id, ov.group_id, ov.value
         FROM product_option_values ov
         JOIN product_option_groups g ON g.id = ov.group_id
         WHERE g.product_id = ?`
      )
      .bind(productId),
    db
      .prepare(
        `SELECT id, sku, option_signature, stock_quantity, is_active
         FROM product_variants WHERE product_id = ?`
      )
      .bind(productId),
  ]);

  return {
    groups: (groups.results as unknown as {
      id: string;
      key: string;
      name: string;
      sort_order: number;
    }[]).map((row) => ({ id: row.id, key: row.key, name: row.name, sortOrder: row.sort_order })),
    values: (values.results as unknown as { id: string; group_id: string; value: string }[]).map(
      (row) => ({ id: row.id, groupId: row.group_id, value: row.value })
    ),
    variants: (variants.results as unknown as {
      id: string;
      sku: string | null;
      option_signature: string;
      stock_quantity: number;
      is_active: number;
    }[]).map((row) => ({
      id: row.id,
      sku: row.sku,
      signature: row.option_signature,
      stockQuantity: row.stock_quantity,
      isActive: row.is_active === 1,
    })),
  };
}

/* -------------------------------------------------------------------------- */
/* Turning the plan into statements                                           */
/* -------------------------------------------------------------------------- */

export interface OptionWrite {
  /** Appended to the caller's batch, so the whole product save is one
   * transaction: options, variants, the legacy mirror, the quantities and the
   * ledger rows that explain them. */
  statements: D1PreparedStatement[];
  /** How many combinations the save moves stock for, for the message the admin
   * reads. Nothing depends on it. */
  stockMoves: number;
  plan: OptionPlan;
}

/** Rejects a SKU already spoken for by another product's variant.
 *
 * `product_variants.sku` is globally unique, so the database would refuse this
 * anyway -- but it would refuse it as a constraint error in the middle of a
 * batch, which reaches the admin as a crash rather than as "that code is
 * taken". */
async function assertSkusAreFree(claims: { sku: string; variantId: string }[]): Promise<void> {
  if (claims.length === 0) return;
  const db = await getDB();
  const placeholders = claims.map(() => "?").join(", ");
  const rows = await db
    .prepare(`SELECT id, sku FROM product_variants WHERE sku IN (${placeholders})`)
    .bind(...claims.map((claim) => claim.sku))
    .all<{ id: string; sku: string }>();

  const ownerBySku = new Map((rows.results ?? []).map((row) => [row.sku, row.id]));
  for (const claim of claims) {
    const owner = ownerBySku.get(claim.sku);
    if (owner && owner !== claim.variantId) {
      throw new OptionValidationError(`The SKU "${claim.sku}" is already used by another product.`);
    }
  }
}

/** Plans a save and returns everything needed to carry it out.
 *
 * `imageIdByUrl` is the product's gallery *after* the caller's own image diff,
 * which is what keeps a variant's picture pointing at a row that still exists
 * and belongs to this product -- an image id can only ever come from this map.
 */
export async function planOptionWrite(params: {
  productId: string;
  input: OptionsInput;
  imageIdByUrl: Map<string, string>;
  isNewProduct: boolean;
  /** Recorded on every ledger row the save writes. */
  userId: string;
  note: string;
}): Promise<OptionWrite> {
  const { productId, input, imageIdByUrl, isNewProduct, userId, note } = params;
  const db = await getDB();

  const current = isNewProduct ? EMPTY_STATE : await readCurrentState(productId);
  const plan = planOptions(current, input, imageIdByUrl);
  await assertSkusAreFree(plan.skuClaims);

  const statements: D1PreparedStatement[] = [];

  // Retirements first. Nothing here can collide with the inserts below, but
  // clearing the old rows before claiming combinations keeps the partial
  // unique index on (product_id, option_signature) out of the way.
  for (const variantId of plan.retireVariantIds) {
    statements.push(
      db.prepare("UPDATE product_variants SET is_active = 0 WHERE id = ?").bind(variantId)
    );
  }
  for (const groupId of plan.retireGroupIds) {
    statements.push(
      db.prepare("UPDATE product_option_groups SET is_active = 0 WHERE id = ?").bind(groupId)
    );
  }
  for (const valueId of plan.retireValueIds) {
    statements.push(
      db.prepare("UPDATE product_option_values SET is_active = 0 WHERE id = ?").bind(valueId)
    );
  }

  for (const group of plan.groups) {
    statements.push(
      group.isNew
        ? db
            .prepare(
              `INSERT INTO product_option_groups (id, product_id, key, name, display, show_labels, sort_order, is_active)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
            )
            .bind(
              group.id,
              productId,
              group.key,
              group.name,
              group.display,
              group.showLabels ? 1 : 0,
              group.sortOrder,
              group.isActive ? 1 : 0
            )
        : db
            .prepare(
              `UPDATE product_option_groups
               SET name = ?, display = ?, show_labels = ?, sort_order = ?, is_active = ?
               WHERE id = ? AND product_id = ?`
            )
            .bind(
              group.name,
              group.display,
              group.showLabels ? 1 : 0,
              group.sortOrder,
              group.isActive ? 1 : 0,
              group.id,
              productId
            )
    );
  }

  for (const value of plan.values) {
    statements.push(
      value.isNew
        ? db
            .prepare(
              `INSERT INTO product_option_values (id, group_id, value, label, color_hex, image_url, sort_order, is_active)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
            )
            .bind(
              value.id,
              value.groupId,
              value.value,
              value.label,
              value.colorHex,
              value.imageUrl,
              value.sortOrder,
              value.isActive ? 1 : 0
            )
        : db
            .prepare(
              `UPDATE product_option_values
               SET label = ?, color_hex = ?, image_url = ?, sort_order = ?, is_active = ?
               WHERE id = ?`
            )
            .bind(
              value.label,
              value.colorHex,
              value.imageUrl,
              value.sortOrder,
              value.isActive ? 1 : 0,
              value.id
            )
    );
  }

  for (const variant of plan.variants) {
    if (variant.isNew) {
      // Stock starts at zero here and arrives through the ledger afterwards,
      // so `stock_quantity` and `inventory_movements` never disagree.
      statements.push(
        db
          .prepare(
            `INSERT INTO product_variants (id, product_id, sku, option1_name, option1_value,
                                           option2_name, option2_value, swatch, price, old_price,
                                           stock_quantity, low_stock_threshold, image_id,
                                           is_active, option_signature)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?)`
          )
          .bind(
            variant.id,
            productId,
            variant.sku,
            variant.legacy.option1Name,
            variant.legacy.option1Value,
            variant.legacy.option2Name,
            variant.legacy.option2Value,
            variant.legacy.swatch,
            variant.price,
            variant.oldPrice,
            variant.lowStockThreshold,
            variant.imageId,
            variant.isActive ? 1 : 0,
            variant.signature
          )
      );
    } else {
      // `stock_quantity` and `reserved_quantity` are deliberately absent: one
      // moves only through inventory.ts, the other only through checkout.
      statements.push(
        db
          .prepare(
            `UPDATE product_variants
             SET sku = ?, option1_name = ?, option1_value = ?, option2_name = ?, option2_value = ?,
                 swatch = ?, price = ?, old_price = ?, low_stock_threshold = ?, image_id = ?,
                 is_active = ?, option_signature = ?
             WHERE id = ? AND product_id = ?`
          )
          .bind(
            variant.sku,
            variant.legacy.option1Name,
            variant.legacy.option1Value,
            variant.legacy.option2Name,
            variant.legacy.option2Value,
            variant.legacy.swatch,
            variant.price,
            variant.oldPrice,
            variant.lowStockThreshold,
            variant.imageId,
            variant.isActive ? 1 : 0,
            variant.signature,
            variant.id,
            productId
          )
      );
    }

    statements.push(
      db.prepare("DELETE FROM product_variant_options WHERE variant_id = ?").bind(variant.id)
    );
    for (const link of variant.links) {
      statements.push(
        db
          .prepare(
            "INSERT INTO product_variant_options (variant_id, group_id, value_id) VALUES (?, ?, ?)"
          )
          .bind(variant.id, link.groupId, link.valueId)
      );
    }
  }

  // Stock last, because a new combination's row has to exist before its
  // quantity can be changed or its ledger row can reference it.
  //
  // The figure applied is a difference, not the absolute number the admin
  // typed. If a sale lands between reading the current quantity and this batch
  // running, a difference composes with it and an absolute figure would erase
  // it. `reserved_quantity` is never touched here -- it belongs to checkout.
  let stockMoves = 0;
  for (const variant of plan.variants) {
    if (variant.stockTarget === null) continue;
    const delta = variant.stockTarget - variant.stockCurrent;
    if (delta === 0) continue;
    stockMoves += 1;
    statements.push(
      ...stockChangeStatements(db, variant.id, delta, delta > 0 ? "restock" : "adjustment", {
        referenceType: "manual",
        note,
        userId,
      })
    );
  }

  return { statements, stockMoves, plan };
}
