import { getDB } from "@/lib/db";
import { formatPrice } from "@/lib/format";
import { getDeliveryMethod } from "@/lib/checkout";
import type { DeliveryMethodId, Order, OrderItem, OrderStatus, OrderStep } from "@/types";

/** When the simulated tracker shows an order as delivered. Exported because
 * review eligibility has to agree with what the shopper's tracker says. */
export const DELIVERED_AFTER_HOURS = 48;

const STEP_DEFS: { status: OrderStatus; label: string; afterMs: number }[] = [
  { status: "placed", label: "Order Placed", afterMs: 0 },
  { status: "confirmed", label: "Confirmed", afterMs: 2 * 60 * 1000 },
  { status: "shipped", label: "Shipped", afterMs: 60 * 60 * 1000 },
  { status: "out_for_delivery", label: "Out for Delivery", afterMs: 24 * 60 * 60 * 1000 },
  { status: "delivered", label: "Delivered", afterMs: DELIVERED_AFTER_HOURS * 60 * 60 * 1000 },
];

const POINTS_PER_TAKA = 1 / 50;

export function calcPointsEarned(total: number): number {
  return Math.max(1, Math.floor(total * POINTS_PER_TAKA));
}

export function generateOrderNumber(): string {
  const rand = Math.floor(1_000_000 + Math.random() * 9_000_000);
  return `ZUP${rand}`;
}

/** Orders don't have a background job pushing status forward - the timeline
 * is simulated from elapsed time since `placed_at` so the tracker still
 * feels alive without needing a cron/worker. */
function deriveSteps(placedAt: string, status: OrderStatus): { steps: OrderStep[]; current: OrderStatus; estimatedDeliveryAt: string } {
  const placedMs = new Date(`${placedAt.replace(" ", "T")}Z`).getTime();
  const now = Date.now();
  const cancelled = status === "cancelled";

  const steps: OrderStep[] = STEP_DEFS.map(({ status: stepStatus, label, afterMs }) => {
    const at = placedMs + afterMs;
    const done = !cancelled && now >= at;
    return { status: stepStatus, label, done, at: done ? new Date(at).toISOString() : null };
  });

  let current: OrderStatus = "placed";
  for (const step of steps) {
    if (step.done) current = step.status;
  }

  const deliveredDef = STEP_DEFS[STEP_DEFS.length - 1];
  const estimatedDeliveryAt = new Date(placedMs + deliveredDef.afterMs).toISOString();

  return { steps, current: cancelled ? "cancelled" : current, estimatedDeliveryAt };
}

export function statusLabel(status: OrderStatus): string {
  if (status === "cancelled") return "Cancelled";
  return STEP_DEFS.find((s) => s.status === status)?.label ?? status;
}

interface OrderRow {
  id: string;
  order_number: string;
  status: OrderStatus;
  subtotal: number;
  shipping_fee: number;
  total: number;
  points_earned: number;
  address_label: string;
  address_full_name: string;
  address_phone: string;
  address_line: string;
  address_area: string | null;
  address_district: string | null;
  address_city: string;
  payment_label: string;
  delivery_method: DeliveryMethodId;
  placed_at: string;
}

interface OrderItemRow {
  id: string;
  order_id: string;
  product_id: string;
  name: string;
  image: string;
  color: string | null;
  price: number;
  old_price: number;
  quantity: number;
}

function toOrder(row: OrderRow, itemRows: OrderItemRow[]): Order {
  const { steps, current, estimatedDeliveryAt } = deriveSteps(row.placed_at, row.status);
  const delivery = getDeliveryMethod(row.delivery_method);
  const items: OrderItem[] = itemRows.map((item) => ({
    id: item.id,
    productId: item.product_id,
    name: item.name,
    image: item.image,
    color: item.color,
    price: item.price,
    oldPrice: item.old_price || item.price,
    quantity: item.quantity,
  }));

  return {
    id: row.id,
    orderNumber: row.order_number,
    status: current,
    currentStepLabel: statusLabel(current),
    subtotal: row.subtotal,
    shippingFee: row.shipping_fee,
    total: row.total,
    pointsEarned: row.points_earned,
    addressLabel: row.address_label,
    addressFullName: row.address_full_name,
    addressPhone: row.address_phone,
    addressLine: row.address_line,
    addressArea: row.address_area,
    addressDistrict: row.address_district,
    addressCity: row.address_city,
    paymentLabel: row.payment_label,
    deliveryMethod: delivery.id,
    deliveryMethodName: delivery.name,
    deliveryEta: delivery.eta,
    placedAt: row.placed_at,
    estimatedDeliveryAt,
    steps,
    items,
  };
}

export async function getOrders(userId: string): Promise<Order[]> {
  const db = await getDB();
  const { results: orderRows } = await db
    .prepare(
      `SELECT id, order_number, status, subtotal, shipping_fee, total, points_earned,
              address_label, address_full_name, address_phone, address_line, address_area,
              address_district, address_city, payment_label, delivery_method, placed_at
       FROM orders WHERE user_id = ? ORDER BY placed_at DESC`
    )
    .bind(userId)
    .all<OrderRow>();

  if (orderRows.length === 0) return [];

  const orderIds = orderRows.map((o) => o.id);
  const placeholders = orderIds.map(() => "?").join(",");
  const { results: itemRows } = await db
    .prepare(`SELECT * FROM order_items WHERE order_id IN (${placeholders})`)
    .bind(...orderIds)
    .all<OrderItemRow>();

  return orderRows.map((row) =>
    toOrder(
      row,
      itemRows.filter((item) => item.order_id === row.id)
    )
  );
}

export async function getOrder(userId: string, orderId: string): Promise<Order | null> {
  const db = await getDB();
  const row = await db
    .prepare(
      `SELECT id, order_number, status, subtotal, shipping_fee, total, points_earned,
              address_label, address_full_name, address_phone, address_line, address_area,
              address_district, address_city, payment_label, delivery_method, placed_at
       FROM orders WHERE id = ? AND user_id = ?`
    )
    .bind(orderId, userId)
    .first<OrderRow>();

  if (!row) return null;

  const { results: itemRows } = await db
    .prepare("SELECT * FROM order_items WHERE order_id = ?")
    .bind(row.id)
    .all<OrderItemRow>();

  return toOrder(row, itemRows);
}

export function formatOrderTotal(order: Order): string {
  return formatPrice(order.total);
}
