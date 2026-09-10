"use server";

import { redirect } from "next/navigation";
import { getDB } from "@/lib/db";
import { createSession, requireUser } from "@/lib/session";
import { getCartItems, cartSubtotal } from "@/lib/cart";
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
      .prepare("INSERT INTO users (id, name, phone) VALUES (?, ?, ?)")
      .bind(userId, formatBdPhone(phone), phone)
      .run();
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

  const items = await getCartItems(user.id);
  if (items.length === 0) return { error: "Your cart is empty." };

  // The fee charged comes from the shop's own settings, and the free-shipping
  // threshold is applied here so the amount recorded on the order is the
  // amount the shopper was shown.
  const settings = await getShopSettings();
  const delivery = getDeliveryMethod(details.deliveryMethod, {
    standard: settings.standardShippingFee,
    express: settings.expressShippingFee,
  });
  const payment = getPaymentOption(details.paymentMethod);
  const subtotal = cartSubtotal(items);
  const shippingFee = shippingFeeFor(subtotal, delivery.id, settings);
  const total = subtotal + shippingFee;
  const pointsEarned = calcPointsEarned(total);

  const orderId = crypto.randomUUID();
  const orderNumber = generateOrderNumber();

  await db
    .prepare(
      `INSERT INTO orders
        (id, order_number, user_id, status, subtotal, shipping_fee, total, points_earned,
         address_label, address_full_name, address_phone, address_line, address_area, address_city,
         payment_label, delivery_method)
       VALUES (?, ?, ?, 'placed', ?, ?, ?, ?, 'Home', ?, ?, ?, ?, ?, ?, ?)`
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
      delivery.id
    )
    .run();

  for (const item of items) {
    await db
      .prepare(
        `INSERT INTO order_items (id, order_id, product_id, name, image, color, price, old_price, quantity)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        crypto.randomUUID(),
        orderId,
        item.productId,
        item.product.name,
        item.product.image,
        item.color || null,
        item.product.price,
        item.product.oldPrice,
        item.quantity
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
  await db.prepare("DELETE FROM cart_items WHERE user_id = ?").bind(user.id).run();

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
