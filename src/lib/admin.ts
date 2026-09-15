/** Role gates, the admin audit trail, platform settings and dashboard figures.
 *
 * Authorization is enforced here rather than in the UI: a page that hides an
 * admin button is not a security boundary, but `requireAdmin()` throwing
 * before a query runs is. Every server action behind the admin or seller
 * dashboards should open with one of these guards. */

import { getDB } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import type { AuthUser, UserRole } from "@/types";

/* -------------------------------------------------------------------------- */
/* Guards                                                                     */
/* -------------------------------------------------------------------------- */

export class AuthorizationError extends Error {
  constructor(message = "You don't have permission to do that.") {
    super(message);
    this.name = "AuthorizationError";
  }
}

export async function requireRole(...roles: UserRole[]): Promise<AuthUser> {
  const user = await getCurrentUser();
  if (!user) throw new AuthorizationError("You need to sign in first.");
  if (!roles.includes(user.role)) throw new AuthorizationError();
  return user;
}

export async function requireAdmin(): Promise<AuthUser> {
  return requireRole("admin");
}

/** Support staff can read orders and answer tickets; admins can do both that
 * and everything else. */
export async function requireStaff(): Promise<AuthUser> {
  return requireRole("admin", "support");
}

/** Confirms the signed-in user owns the given store. Sellers must never be
 * able to edit each other's products by guessing an id. */
export async function requireSellerOwnership(sellerId: string): Promise<AuthUser> {
  const user = await getCurrentUser();
  if (!user) throw new AuthorizationError("You need to sign in first.");
  if (user.role === "admin") return user;

  const db = await getDB();
  const row = await db
    .prepare("SELECT id FROM sellers WHERE id = ? AND user_id = ?")
    .bind(sellerId, user.id)
    .first<{ id: string }>();

  if (!row) throw new AuthorizationError("That store isn't yours to manage.");
  return user;
}

/** Same check, one level down: does this user control the store that owns
 * this product? */
export async function requireProductOwnership(productId: string): Promise<AuthUser> {
  const user = await getCurrentUser();
  if (!user) throw new AuthorizationError("You need to sign in first.");
  if (user.role === "admin") return user;

  const db = await getDB();
  const row = await db
    .prepare(
      `SELECT p.id FROM products p
       JOIN sellers s ON s.id = p.seller_id
       WHERE p.id = ? AND s.user_id = ?`
    )
    .bind(productId, user.id)
    .first<{ id: string }>();

  if (!row) throw new AuthorizationError("That product isn't yours to manage.");
  return user;
}

/* -------------------------------------------------------------------------- */
/* Audit trail                                                                */
/* -------------------------------------------------------------------------- */

/** Records a privileged action. Call this after every admin write -- price
 * overrides, seller suspensions, refunds -- so there is always an answer to
 * "who changed this, and what did it look like before?". */
export async function logAdminAction(
  adminUserId: string | null,
  action: string,
  entityType: string,
  entityId: string | null,
  options: { before?: unknown; after?: unknown; ipAddress?: string | null } = {}
): Promise<void> {
  const db = await getDB();
  await db
    .prepare(
      `INSERT INTO admin_audit_log (id, admin_user_id, action, entity_type, entity_id,
                                    before_json, after_json, ip_address)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      crypto.randomUUID(),
      adminUserId,
      action,
      entityType,
      entityId,
      options.before === undefined ? null : JSON.stringify(options.before),
      options.after === undefined ? null : JSON.stringify(options.after),
      options.ipAddress ?? null
    )
    .run();
}

export interface AuditEntry {
  id: string;
  adminName: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  createdAt: string;
}

export async function listAuditLog(
  options: { entityType?: string; entityId?: string; limit?: number } = {}
): Promise<AuditEntry[]> {
  const db = await getDB();
  const clauses: string[] = [];
  const binds: unknown[] = [];

  if (options.entityType) {
    clauses.push("a.entity_type = ?");
    binds.push(options.entityType);
  }
  if (options.entityId) {
    clauses.push("a.entity_id = ?");
    binds.push(options.entityId);
  }
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";

  const { results } = await db
    .prepare(
      `SELECT a.id, u.name AS admin_name, a.action, a.entity_type, a.entity_id, a.created_at
       FROM admin_audit_log a
       LEFT JOIN users u ON u.id = a.admin_user_id
       ${where}
       ORDER BY a.created_at DESC LIMIT ?`
    )
    .bind(...binds, options.limit ?? 100)
    .all<{
      id: string;
      admin_name: string | null;
      action: string;
      entity_type: string;
      entity_id: string | null;
      created_at: string;
    }>();

  return results.map((row) => ({
    id: row.id,
    adminName: row.admin_name,
    action: row.action,
    entityType: row.entity_type,
    entityId: row.entity_id,
    createdAt: row.created_at,
  }));
}

/* -------------------------------------------------------------------------- */
/* User administration                                                        */
/* -------------------------------------------------------------------------- */

export async function setUserRole(userId: string, role: UserRole): Promise<void> {
  const db = await getDB();
  await db
    .prepare("UPDATE users SET role = ?, updated_at = datetime('now') WHERE id = ?")
    .bind(role, userId)
    .run();
}

/** Suspending or banning takes effect immediately: `getCurrentUser` filters on
 * status, and existing sessions are deleted so the account is signed out
 * everywhere rather than only being blocked at next login. */
export async function setUserStatus(
  userId: string,
  status: "active" | "suspended" | "banned"
): Promise<void> {
  const db = await getDB();
  const statements = [
    db
      .prepare("UPDATE users SET status = ?, updated_at = datetime('now') WHERE id = ?")
      .bind(status, userId),
  ];

  if (status !== "active") {
    statements.push(db.prepare("DELETE FROM sessions WHERE user_id = ?").bind(userId));
  }

  await db.batch(statements);
}

/* -------------------------------------------------------------------------- */
/* Platform settings                                                          */
/* -------------------------------------------------------------------------- */

export async function getSettings(): Promise<Record<string, string>> {
  const db = await getDB();
  const { results } = await db
    .prepare("SELECT key, value FROM site_settings")
    .all<{ key: string; value: string }>();

  return Object.fromEntries(results.map((row) => [row.key, row.value]));
}

export async function getSetting(key: string, fallback: string): Promise<string> {
  const db = await getDB();
  const row = await db
    .prepare("SELECT value FROM site_settings WHERE key = ?")
    .bind(key)
    .first<{ value: string }>();
  return row?.value ?? fallback;
}

export async function setSetting(key: string, value: string): Promise<void> {
  const db = await getDB();
  await db
    .prepare(
      `INSERT INTO site_settings (key, value, updated_at) VALUES (?, ?, datetime('now'))
       ON CONFLICT (key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`
    )
    .bind(key, value)
    .run();
}

/* -------------------------------------------------------------------------- */
/* Dashboard                                                                  */
/* -------------------------------------------------------------------------- */

export interface PlatformStats {
  userCount: number;
  sellerCount: number;
  pendingSellerCount: number;
  productCount: number;
  pendingProductCount: number;
  orderCount: number;
  grossRevenue: number;
  openTicketCount: number;
}

/** Headline numbers for the admin dashboard, in one batched round trip. */
export async function getPlatformStats(): Promise<PlatformStats> {
  const db = await getDB();

  const [users, sellers, products, orders, tickets] = await db.batch<Record<string, number>>([
    db.prepare("SELECT COUNT(*) AS n FROM users WHERE role != 'guest'"),
    db
      .prepare(
        `SELECT COUNT(*) AS n,
                SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS pending
         FROM sellers`
      ),
    db
      .prepare(
        `SELECT COUNT(*) AS n,
                SUM(CASE WHEN status = 'pending_review' THEN 1 ELSE 0 END) AS pending
         FROM products`
      ),
    db
      .prepare(
        `SELECT COUNT(*) AS n, COALESCE(SUM(total), 0) AS revenue
         FROM orders WHERE status != 'cancelled'`
      ),
    db.prepare("SELECT COUNT(*) AS n FROM support_tickets WHERE status IN ('open', 'pending')"),
  ]);

  const first = <T>(result: D1Result<Record<string, number>>): T =>
    (result.results as unknown as T[])[0];

  const sellerRow = first<{ n: number; pending: number | null }>(sellers);
  const productRow = first<{ n: number; pending: number | null }>(products);
  const orderRow = first<{ n: number; revenue: number }>(orders);

  return {
    userCount: first<{ n: number }>(users)?.n ?? 0,
    sellerCount: sellerRow?.n ?? 0,
    pendingSellerCount: sellerRow?.pending ?? 0,
    productCount: productRow?.n ?? 0,
    pendingProductCount: productRow?.pending ?? 0,
    orderCount: orderRow?.n ?? 0,
    grossRevenue: orderRow?.revenue ?? 0,
    openTicketCount: first<{ n: number }>(tickets)?.n ?? 0,
  };
}

/** Daily revenue for the last N days, for the dashboard chart. */
export async function getRevenueByDay(days = 30) {
  const db = await getDB();
  const { results } = await db
    .prepare(
      `SELECT DATE(placed_at) AS day, COUNT(*) AS orders, COALESCE(SUM(total), 0) AS revenue
       FROM orders
       WHERE status != 'cancelled' AND placed_at >= datetime('now', ?)
       GROUP BY day ORDER BY day ASC`
    )
    .bind(`-${days} days`)
    .all<{ day: string; orders: number; revenue: number }>();

  return results;
}

/** Best sellers over a window, joined back to product names. */
export async function getTopProducts(limit = 10, days = 30) {
  const db = await getDB();
  const { results } = await db
    .prepare(
      `SELECT oi.product_id, oi.name, SUM(oi.quantity) AS units,
              SUM(oi.price * oi.quantity) AS revenue
       FROM order_items oi
       JOIN orders o ON o.id = oi.order_id
       WHERE o.status != 'cancelled' AND o.placed_at >= datetime('now', ?)
       GROUP BY oi.product_id, oi.name
       ORDER BY units DESC LIMIT ?`
    )
    .bind(`-${days} days`, limit)
    .all<{ product_id: string; name: string; units: number; revenue: number }>();

  return results;
}
