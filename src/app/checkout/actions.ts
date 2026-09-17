"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getDB } from "@/lib/db";
import { rateLimit } from "@/lib/cache";
import { claimGuest, createSession, getShopper } from "@/lib/session";
import { getCartItems } from "@/lib/cart";
import { calcPointsEarned, generateOrderNumber } from "@/lib/orders";
import { getPaymentOption, normalizeBdPhone, resolveDelivery } from "@/lib/checkout";
import { getShopSettings } from "@/lib/shopSettings";
import {
  clearPhoneVerification,
  confirmPhoneCode,
  getVerifiedPhone,
  issuePhoneCode,
} from "@/lib/verification";
import { isServedLocation } from "@/data/locations";
import { availablePaymentMethods, createPaymentStatement } from "@/lib/payments";
import { formatPrice } from "@/lib/format";
import { reserveStock, releaseReservation } from "@/lib/inventory";
import { getBuyNowLine, consumeBuyNowSession, clearBuyNowCookie } from "@/lib/buyNow";
import { planSuborders, commissionRates, createSuborders } from "@/lib/suborders";

export interface SendCodeState {
  error?: string;
  /** Normalized `+8801XXXXXXXXX` the code was sent to. */
  phone?: string;
  /** True once the gateway has accepted the message, so the checkout can say
   * the code is on its way rather than hoping it is. */
  sent?: boolean;
  /** The issued code, echoed back so checkout can be exercised without an SMS
   * gateway. Only ever populated when the `otp_demo_mode` setting is on, which
   * is off by default -- returning it unconditionally let anyone sign in as any
   * phone number by reading it out of this response. */
  demoCode?: string;
}

/* Every code costs the shop a message at the gateway, and this action is a
 * public POST with no session behind it -- so the ceiling is enforced here
 * rather than left to the 30-second timer in the UI. The window is generous
 * enough that a shopper who mistypes their number twice and resends is never
 * stopped, and tight enough that the send button is not a way to spend the
 * shop's SMS balance. */
const CODES_PER_PHONE_PER_HOUR = 5;
const CODES_PER_IP_PER_HOUR = 15;

/** Throttles on KV, which may be unavailable. A cache that is down must not
 * take checkout down with it: the per-phone 30-second rule below still stands
 * and lives in D1. */
async function overLimit(identifier: string, limit: number): Promise<boolean> {
  try {
    const { allowed } = await rateLimit(identifier, limit, 3600);
    return !allowed;
  } catch {
    return false;
  }
}

/** Step 3: issues the code for the delivery number and sends it by SMS. */
export async function sendCodeAction(rawPhone: string): Promise<SendCodeState> {
  const phone = normalizeBdPhone(rawPhone);
  if (!phone) return { error: "Enter a valid Bangladeshi mobile number, e.g. 01712345678." };

  /* The 30-second rule is checked before the hourly ones on purpose: a
   * double-tapped resend is not an attempt on the shop's SMS balance, and
   * counting it against the hourly ceiling would let a shopper lock themselves
   * out by tapping a button that was never going to send anything. */
  const db = await getDB();
  const recent = await db
    .prepare(
      "SELECT id FROM phone_verifications WHERE phone = ? AND created_at > datetime('now', '-30 seconds')"
    )
    .bind(phone)
    .first<{ id: string }>();

  if (recent) return { error: "A code was just sent. Please wait a moment before asking for another." };

  if (await overLimit(`otp:phone:${phone}`, CODES_PER_PHONE_PER_HOUR)) {
    return { error: "Too many codes have been sent to this number. Please try again in an hour." };
  }

  const caller = (await headers()).get("cf-connecting-ip");
  if (caller && (await overLimit(`otp:ip:${caller}`, CODES_PER_IP_PER_HOUR))) {
    return { error: "Too many verification codes requested. Please try again in an hour." };
  }

  const issued = await issuePhoneCode(phone);

  // Demo mode prints the code in the page instead of sending it. Every other
  // failure means the shopper has nothing to type, so they are told plainly
  // rather than left waiting for a message that is not coming.
  if (issued.demoCode) return { phone, sent: false, demoCode: issued.demoCode };
  if (!issued.delivered) return { error: issued.error ?? "We couldn't send the code just now." };

  return { phone, sent: true };
}

export interface PlaceOrderState {
  error?: string;
}

export interface CheckoutDetails {
  fullName: string;
  phone: string;
  division: string;
  district: string;
  area: string;
  addressDetails: string;
  deliveryMethod: string;
  paymentMethod: string;
  code: string;
  /** Whether the cart is being bought, or a single Buy Now line. */
  source: "cart" | "buynow";
  /** Identifies this attempt at placing an order. A retry carries the same key
   * and lands on the order already written rather than a second one. */
  idempotencyKey: string;
}

/** One line about to become an order line, priced from the database. */
interface OrderLine {
  productId: string;
  variantId: string | null;
  /** Who sold it, read at the moment of sale and never looked up again. */
  sellerId: string | null;
  label: string;
  name: string;
  image: string;
  price: number;
  oldPrice: number;
  quantity: number;
}

/** Step 3: verifies the number, snapshots the address and turns the cart into an order. */
export async function placeOrderAction(
  details: CheckoutDetails,
  _prevState: PlaceOrderState,
  _formData: FormData
): Promise<PlaceOrderState> {
  // Signed in or not: a guest buys with nothing but a confirmed phone number.
  const shopper = await getShopper();
  if (!shopper) return { error: "Your cart is empty." };
  const db = await getDB();

  const fullName = details.fullName.trim();
  const addressDetails = details.addressDetails.trim();
  const phone = normalizeBdPhone(details.phone);

  if (!fullName) return { error: "Enter the name we should deliver to." };
  if (!phone) return { error: "Enter a valid Bangladeshi mobile number." };
  if (!isServedLocation(details.division, details.district, details.area)) {
    return { error: "Pick a division, district and area we deliver to." };
  }
  if (addressDetails.length < 6) return { error: "Enter your full address so the rider can find you." };

  // Hiding a button is not a control. A method with no credentials behind it is
  // refused here too, so a crafted request cannot place an order against a
  // gateway that cannot take the money.
  if (!(await availablePaymentMethods()).includes(details.paymentMethod)) {
    return { error: "That payment method is not available yet. Please choose another." };
  }

  // The delivery number has to be confirmed before a Cash on Delivery order is
  // accepted - unless this browser already confirmed that exact number.
  if ((await getVerifiedPhone()) !== phone) {
    const check = await confirmPhoneCode(details.code);
    if (!check.ok) return { error: check.error };
    if (check.phone !== phone) return { error: "That code was sent to a different number." };
  }

  // Has this exact attempt already produced an order? A double-tapped button or
  // a retried request gets the order it already wrote, not a second one.
  if (details.idempotencyKey) {
    const already = await db
      .prepare("SELECT id FROM orders WHERE idempotency_key = ? AND user_id = ?")
      .bind(details.idempotencyKey, shopper.id)
      .first<{ id: string }>();
    if (already) redirect(`/checkout/confirmed/${already.id}`);
  }

  // Buy Now buys its own line and never reads the cart.
  const buyNow = details.source === "buynow" ? await getBuyNowLine(shopper.id) : null;
  if (details.source === "buynow" && !buyNow) {
    return { error: "That checkout session has expired. Please start again." };
  }

  // A line whose combination has been retired cannot be bought. It is refused
  // by name rather than quietly left out of the order -- which is the same
  // thing the cart page is already telling the shopper.
  const cartLines = buyNow ? [] : await getCartItems(shopper.id);
  if (cartLines.some((item) => item.unavailable)) {
    return {
      error:
        "One or more items in your cart are no longer available. Remove them from the cart to continue.",
    };
  }

  const lines: OrderLine[] = buyNow
    ? [
        {
          productId: buyNow.productId,
          variantId: buyNow.variantId,
          sellerId: null, // filled in below, from the product
          label: buyNow.label,
          name: buyNow.name,
          image: buyNow.image,
          price: buyNow.price,
          oldPrice: buyNow.oldPrice,
          quantity: buyNow.quantity,
        },
      ]
    : cartLines.map((item) => ({
        productId: item.productId,
        variantId: item.variantId,
        sellerId: null, // filled in below, from the product

        label: item.color,
        name: item.product.name,
        image: item.product.image,
        price: item.product.price,
        oldPrice: item.product.oldPrice,
        quantity: item.quantity,
      }));

  if (lines.length === 0) return { error: "Your cart is empty." };

  /* Who the order belongs to. The number was confirmed above, so a guest now
   * becomes a customer under it -- or, when the number already has an account,
   * the order goes to that account and the browser is signed in to it below.
   * The lines were read from the guest's own cart either way, so an account's
   * saved cart is never bought by accident. */
  const buyer = shopper.isGuest
    ? await claimGuest(shopper, phone, fullName)
    : { id: shopper.id, existing: false };

  /* Who sells each line, read now and stored on the order line. A product that
   * later moves to a different seller does not rewrite the history of orders
   * already placed. */
  const productIds = [...new Set(lines.map((line) => line.productId))];
  const { results: owners } = await db
    .prepare(
      `SELECT id, seller_id FROM products WHERE id IN (${productIds.map(() => "?").join(",")})`
    )
    .bind(...productIds)
    .all<{ id: string; seller_id: string | null }>();

  const sellerOf = new Map(owners.map((row) => [row.id, row.seller_id]));
  for (const line of lines) line.sellerId = sellerOf.get(line.productId) ?? null;

  // The fee charged comes from the shop's own settings, and which option this
  // order gets is decided here rather than taken from the browser: a request
  // for free delivery under the threshold is given home delivery at the full
  // fee instead, so no hand-made request can buy its way out of the charge.
  const settings = await getShopSettings();
  const payment = getPaymentOption(details.paymentMethod);
  const subtotal = lines.reduce((sum, line) => sum + line.price * line.quantity, 0);
  const delivery = resolveDelivery(details.deliveryMethod, subtotal, settings);
  const shippingFee = delivery.fee;
  const total = subtotal + shippingFee;
  const pointsEarned = calcPointsEarned(total);

  /* Hold the stock before the order exists. Each hold is a single conditional
   * UPDATE, so two shoppers cannot both take the last one; if any line cannot
   * be held, the holds already taken are given straight back and nothing is
   * written. Lines with no variant -- rows added before variants existed --
   * have nothing to hold. */
  const held: { variantId: string; quantity: number }[] = [];
  for (const line of lines) {
    if (!line.variantId) continue;

    if (!(await reserveStock(line.variantId, line.quantity))) {
      for (const hold of held) await releaseReservation(hold.variantId, hold.quantity);
      return {
        error: `${line.name}${line.label ? ` (${line.label})` : ""} is no longer available in that quantity.`,
      };
    }
    held.push({ variantId: line.variantId, quantity: line.quantity });
  }

  const releaseHolds = async () => {
    for (const hold of held) await releaseReservation(hold.variantId, hold.quantity);
  };

  const orderId = crypto.randomUUID();
  const orderNumber = generateOrderNumber();

  /* Writing the order is what claims the idempotency key. If two submissions
   * race past the check above, the unique index lets exactly one through; the
   * loser gives its holds back and joins the winner\'s order rather than
   * creating a second one. */
  try {
    await db
      .prepare(
        `INSERT INTO orders
          (id, order_number, user_id, status, subtotal, shipping_fee, total, points_earned,
           address_label, address_full_name, address_phone, address_line, address_area,
           address_district, address_city,
           payment_label, delivery_method, idempotency_key, stock_state)
         VALUES (?, ?, ?, 'placed', ?, ?, ?, ?, 'Home', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        orderId,
        orderNumber,
        buyer.id,
        subtotal,
        shippingFee,
        total,
        pointsEarned,
        fullName,
        phone,
        addressDetails,
        details.area,
        details.district,
        details.division,
        payment.name,
        delivery.id,
        details.idempotencyKey || null,
        held.length > 0 ? "reserved" : "none"
      )
      .run();
  } catch (error) {
    // Released once, whatever went wrong, before anything else can throw.
    await releaseHolds();

    const message = error instanceof Error ? error.message : String(error);
    if (/UNIQUE constraint failed/i.test(message)) {
      const winner = await db
        .prepare("SELECT id FROM orders WHERE idempotency_key = ? AND user_id = ?")
        .bind(details.idempotencyKey, buyer.id)
        .first<{ id: string }>();
      if (winner) redirect(`/checkout/confirmed/${winner.id}`);
    }
    throw error;
  }

  /* One suborder per seller, and one for the platform's own goods. Delivery is
   * shared in proportion to what each seller is owed; the parts add back up to
   * exactly what the customer was charged. The suborder takes the order's
   * status and follows it from here -- it never leads, and never touches stock. */
  const rates = await commissionRates(lines.map((line) => line.sellerId));
  const shares = planSuborders(lines, shippingFee, (sellerId) =>
    sellerId ? (rates.get(sellerId) ?? 0) : 0
  );
  const suborderIds = await createSuborders(orderId, "placed", shares);

  for (const line of lines) {
    await db
      .prepare(
        `INSERT INTO order_items (id, order_id, product_id, variant_id, seller_id, suborder_id, name, image, color, price, old_price, quantity)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        crypto.randomUUID(),
        orderId,
        line.productId,
        line.variantId,
        line.sellerId,
        suborderIds.get(line.sellerId) ?? null,
        line.name,
        line.image,
        line.label || null,
        line.price,
        line.oldPrice,
        line.quantity
      )
      .run();
  }

  // Keep the shopper's saved details in step with what they just typed, so the
  // next checkout is prefilled instead of blank. The default address is updated
  // in place rather than appended, so repeat orders don't pile up duplicates.
  const savedDefault = await db
    .prepare("SELECT id FROM addresses WHERE user_id = ? AND is_default = 1")
    .bind(buyer.id)
    .first<{ id: string }>();

  if (savedDefault) {
    await db
      .prepare(
        "UPDATE addresses SET full_name = ?, phone = ?, line1 = ?, area = ?, district = ?, city = ? WHERE id = ?"
      )
      .bind(fullName, phone, addressDetails, details.area, details.district, details.division, savedDefault.id)
      .run();
  } else {
    await db
      .prepare(
        `INSERT INTO addresses (id, user_id, label, full_name, phone, line1, area, district, city, is_default)
         VALUES (?, ?, 'Home', ?, ?, ?, ?, ?, ?, 1)`
      )
      .bind(
        crypto.randomUUID(),
        buyer.id,
        fullName,
        phone,
        addressDetails,
        details.area,
        details.district,
        details.division
      )
      .run();
  }

  await db.prepare("UPDATE users SET points = points + ? WHERE id = ?").bind(pointsEarned, buyer.id).run();

  // users.phone is UNIQUE, so only claim the number when it is free. A guest
  // already took it, or found its owner, in `claimGuest`.
  if (!shopper.isGuest && !shopper.phone) {
    const phoneOwner = await db
      .prepare("SELECT id FROM users WHERE phone = ?")
      .bind(phone)
      .first<{ id: string }>();
    if (!phoneOwner) {
      await db.prepare("UPDATE users SET phone = ? WHERE id = ?").bind(phone, buyer.id).run();
    }
  }
  /* Empty whichever the shopper was actually buying from. A Buy Now order
   * spends its session and leaves the cart exactly as it was. */
  if (buyNow) {
    await consumeBuyNowSession(buyNow.sessionId);
    await clearBuyNowCookie();
  } else {
    await db.prepare("DELETE FROM cart_items WHERE user_id = ?").bind(shopper.id).run();
  }

  /* Three records that belong to every order and were not being written.
   *
   * The payment row: `payment_transactions` has existed since the marketplace
   * migration and nothing ever inserted into it, so an order carried a payment
   * status and no payment. It starts `pending` for every method -- cash on
   * delivery is not paid until someone confirms the cash arrived, and an online
   * payment is not paid until a callback this server verified says so.
   *
   * The first timeline event: the history table only ever got rows when an
   * admin changed something, so every order's timeline began at its second
   * state. "Order placed" is a state change like any other.
   *
   * The admin notification: only the customer was told an order existed. Every
   * admin now gets one, addressed to them, carrying the order id so the
   * notification opens the order it is about.
   *
   * All of it goes in one batch, which D1 runs as a single transaction, so a
   * retry that loses the idempotency race cannot leave a payment or an event
   * behind without its order. */
  const itemSummary =
    lines.length === 1
      ? lines[0].name
      : `${lines[0]?.name ?? "items"} and ${lines.length - 1} more`;

  await db.batch([
    createPaymentStatement(db, {
      orderId,
      method: payment.id,
      provider: payment.id,
      amount: total,
      idempotencyKey: details.idempotencyKey || null,
    }),
    db
      .prepare(
        `INSERT INTO order_status_history (id, order_id, status, note, changed_by)
         VALUES (?, ?, 'placed', ?, ?)`
      )
      .bind(
        crypto.randomUUID(),
        orderId,
        `Placed by the customer · ${payment.name}`,
        buyer.id
      ),
    db
      .prepare(
        `INSERT INTO notifications (id, user_id, title, body, type, order_id)
         VALUES (?, ?, ?, ?, 'order', ?)`
      )
      .bind(
        crypto.randomUUID(),
        buyer.id,
        "Order placed",
        `Your order ${orderNumber} has been placed and you earned ${pointsEarned} points.`,
        orderId
      ),
  ]);

  /* Telling the shop about the order is not part of placing it.
   *
   * It was in the batch above until a test shop with eighty-six admin accounts
   * made the problem obvious: every admin adds a statement to the transaction
   * that writes the order, so the customer waits on work that has nothing to do
   * with their purchase, and a failure in it would roll back a perfectly good
   * order. It now runs after the commit, bounded, and a failure is logged
   * rather than thrown -- a missing notification is a nuisance; a lost order is
   * not. */
  try {
    const admins = await db
      .prepare(
        `SELECT id FROM users WHERE role IN ('admin', 'super_admin')
         ORDER BY CASE role WHEN 'super_admin' THEN 0 ELSE 1 END, created_at ASC
         LIMIT 25`
      )
      .all<{ id: string }>();

    const recipients = admins.results ?? [];
    if (recipients.length > 0) {
      await db.batch(
        recipients.map((admin) =>
          db
            .prepare(
              `INSERT INTO notifications (id, user_id, title, body, type, order_id)
               VALUES (?, ?, ?, ?, 'order', ?)`
            )
            .bind(
              crypto.randomUUID(),
              admin.id,
              `New order ${orderNumber}`,
              `${fullName} · ${itemSummary} · ${formatPrice(total)} · ${payment.name}`,
              orderId
            )
        )
      );
    }
  } catch (error) {
    console.error("admin new-order notification failed", { orderId, error });
  }

  await clearPhoneVerification();

  // A guest whose number already had an account is signed in to it, so the
  // confirmation and the order history are theirs to see. Whatever else the
  // guest had in the cart moves across with them.
  if (buyer.existing) await createSession(buyer.id);

  redirect(`/checkout/confirmed/${orderId}`);
}
