"use server";

import { redirect } from "next/navigation";
import { getDB } from "@/lib/db";
import { createSession, requireUser } from "@/lib/session";
import { getCartItems } from "@/lib/cart";
import { calcPointsEarned, generateOrderNumber } from "@/lib/orders";
import { getDeliveryMethod, getPaymentOption, normalizeBdPhone, formatBdPhone } from "@/lib/checkout";
import { getShopSettings, shippingFeeFor } from "@/lib/shopSettings";
import {
  clearPhoneVerification,
  confirmPhoneCode,
  getVerifiedPhone,
  issuePhoneCode,
} from "@/lib/verification";
import { isServedLocation } from "@/data/locations";
import { reserveStock, releaseReservation } from "@/lib/inventory";
import { getBuyNowLine, consumeBuyNowSession, clearBuyNowCookie } from "@/lib/buyNow";
import { planSuborders, commissionRates, createSuborders } from "@/lib/suborders";

export interface SendCodeState {
  error?: string;
  /** Normalized `+8801XXXXXXXXX` the code was sent to. */
  phone?: string;
  /** The issued code, echoed back so checkout can be exercised without an SMS
   * gateway. Only ever populated when the `otp_demo_mode` setting is on, which
   * is off by default -- returning it unconditionally let anyone sign in as any
   * phone number by reading it out of this response. */
  demoCode?: string;
}

/** Step 1 / step 3: issues the code for a mobile number. */
export async function sendCodeAction(rawPhone: string): Promise<SendCodeState> {
  const phone = normalizeBdPhone(rawPhone);
  if (!phone) return { error: "Enter a valid Bangladeshi mobile number, e.g. 01712345678." };

  const db = await getDB();
  const recent = await db
    .prepare(
      "SELECT id FROM phone_verifications WHERE phone = ? AND created_at > datetime('now', '-30 seconds')"
    )
    .bind(phone)
    .first<{ id: string }>();

  if (recent) return { error: "A code was just sent. Please wait a moment before asking for another." };

  const { code } = await issuePhoneCode(phone);

  // The code goes back to the browser only in demo mode. With no SMS gateway
  // connected and the setting off, the code is issued and simply not shown --
  // which is the correct production behaviour, not a bug.
  const { otpDemoMode } = await getShopSettings();
  return otpDemoMode ? { phone, demoCode: code } : { phone };
}

export interface SignInState {
  error?: string;
  success?: boolean;
}

/**
 * Step 1: confirms the code and signs the shopper in, creating the account on
 * first use. Possession of the number is what authenticates here, which is why
 * the code is checked before any session is issued.
 */
export async function verifyAndSignInAction(rawPhone: string, code: string): Promise<SignInState> {
  const phone = normalizeBdPhone(rawPhone);
  if (!phone) return { error: "Enter a valid Bangladeshi mobile number." };

  const check = await confirmPhoneCode(code);
  if (!check.ok) return { error: check.error };
  if (check.phone !== phone) return { error: "That code was sent to a different number." };

  const db = await getDB();
  const existing = await db
    .prepare("SELECT id FROM users WHERE phone = ?")
    .bind(phone)
    .first<{ id: string }>();

  let userId = existing?.id;
  if (!userId) {
    userId = crypto.randomUUID();
    await db
      .prepare("INSERT INTO users (id, name, phone, phone_verified) VALUES (?, ?, ?, 1)")
      .bind(userId, formatBdPhone(phone), phone)
      .run();
  } else {
    // Reaching here means a code sent to this number was just confirmed on the
    // server, so the flag is simply true. It was never written before, which
    // left the admin customer list reporting every OTP customer as unverified.
    await db.prepare("UPDATE users SET phone_verified = 1 WHERE id = ?").bind(userId).run();
  }

  await createSession(userId);

  // Redirecting (rather than letting the client re-render) is what reloads
  // /checkout with the cart, saved address and verified number of this account.
  const items = await getCartItems(userId);
  redirect(items.length === 0 ? "/cart" : "/checkout");
}

export interface PlaceOrderState {
  error?: string;
}

export interface CheckoutDetails {
  fullName: string;
  phone: string;
  division: string;
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
  const user = await requireUser();
  const db = await getDB();

  const fullName = details.fullName.trim();
  const addressDetails = details.addressDetails.trim();
  const phone = normalizeBdPhone(details.phone);

  if (!fullName) return { error: "Enter the name we should deliver to." };
  if (!phone) return { error: "Enter a valid Bangladeshi mobile number." };
  if (!isServedLocation(details.division, details.area)) {
    return { error: "Pick a division and area we deliver to." };
  }
  if (addressDetails.length < 6) return { error: "Enter your full address so the rider can find you." };

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
      .bind(details.idempotencyKey, user.id)
      .first<{ id: string }>();
    if (already) redirect(`/checkout/confirmed/${already.id}`);
  }

  // Buy Now buys its own line and never reads the cart.
  const buyNow = details.source === "buynow" ? await getBuyNowLine(user.id) : null;
  if (details.source === "buynow" && !buyNow) {
    return { error: "That checkout session has expired. Please start again." };
  }

  // A line whose combination has been retired cannot be bought. It is refused
  // by name rather than quietly left out of the order -- which is the same
  // thing the cart page is already telling the shopper.
  const cartLines = buyNow ? [] : await getCartItems(user.id);
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

  // The fee charged comes from the shop's own settings, and the free-shipping
  // threshold is applied here so the amount recorded on the order is the
  // amount the shopper was shown.
  const settings = await getShopSettings();
  const delivery = getDeliveryMethod(details.deliveryMethod, {
    standard: settings.standardShippingFee,
    express: settings.expressShippingFee,
  });
  const payment = getPaymentOption(details.paymentMethod);
  const subtotal = lines.reduce((sum, line) => sum + line.price * line.quantity, 0);
  const shippingFee = shippingFeeFor(subtotal, delivery.id, settings);
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
           address_label, address_full_name, address_phone, address_line, address_area, address_city,
           payment_label, delivery_method, idempotency_key, stock_state)
         VALUES (?, ?, ?, 'placed', ?, ?, ?, ?, 'Home', ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        orderId,
        orderNumber,
        user.id,
        subtotal,
        shippingFee,
        total,
        pointsEarned,
        fullName,
        phone,
        addressDetails,
        details.area,
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
        .bind(details.idempotencyKey, user.id)
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
    .bind(user.id)
    .first<{ id: string }>();

  if (savedDefault) {
    await db
      .prepare(
        "UPDATE addresses SET full_name = ?, phone = ?, line1 = ?, area = ?, city = ? WHERE id = ?"
      )
      .bind(fullName, phone, addressDetails, details.area, details.division, savedDefault.id)
      .run();
  } else {
    await db
      .prepare(
        `INSERT INTO addresses (id, user_id, label, full_name, phone, line1, area, city, is_default)
         VALUES (?, ?, 'Home', ?, ?, ?, ?, ?, 1)`
      )
      .bind(crypto.randomUUID(), user.id, fullName, phone, addressDetails, details.area, details.division)
      .run();
  }

  await db.prepare("UPDATE users SET points = points + ? WHERE id = ?").bind(pointsEarned, user.id).run();

  // users.phone is UNIQUE, so only claim the number when it is free.
  if (!user.phone) {
    const phoneOwner = await db
      .prepare("SELECT id FROM users WHERE phone = ?")
      .bind(phone)
      .first<{ id: string }>();
    if (!phoneOwner) {
      await db.prepare("UPDATE users SET phone = ? WHERE id = ?").bind(phone, user.id).run();
    }
  }
  /* Empty whichever the shopper was actually buying from. A Buy Now order
   * spends its session and leaves the cart exactly as it was. */
  if (buyNow) {
    await consumeBuyNowSession(buyNow.sessionId);
    await clearBuyNowCookie();
  } else {
    await db.prepare("DELETE FROM cart_items WHERE user_id = ?").bind(user.id).run();
  }

  await db
    .prepare(
      `INSERT INTO notifications (id, user_id, title, body, type, order_id)
       VALUES (?, ?, ?, ?, 'order', ?)`
    )
    .bind(
      crypto.randomUUID(),
      user.id,
      "Order placed",
      `Your order ${orderNumber} has been placed and you earned ${pointsEarned} points.`,
      orderId
    )
    .run();

  await clearPhoneVerification();

  redirect(`/checkout/confirmed/${orderId}`);
}
