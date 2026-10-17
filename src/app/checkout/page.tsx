import { redirect } from "next/navigation";
import { getShopper } from "@/lib/session";
import { getCartItems, cartSubtotal, cartFreeDelivery } from "@/lib/cart";
import { getBuyNowLine } from "@/lib/buyNow";
import { getAddresses } from "@/lib/addresses";
import { getVerifiedPhone } from "@/lib/verification";
import { isServedLocation } from "@/data/locations";
import { deliveryOptionsFor, type DeliveryDetails } from "@/lib/checkout";
import { availablePaymentMethods } from "@/lib/payments";
import { getShopSettings } from "@/lib/shopSettings";
import CheckoutWizard from "@/components/checkout/CheckoutWizard";
import PixelEvent from "@/components/analytics/PixelEvent";
import { afterResponse } from "@/lib/db";
import { requestMatchData, sendServerEvent } from "@/lib/analytics";

export default async function CheckoutPage({ searchParams }: PageProps<"/checkout">) {
  // No sign-in step. A guest checks out exactly like an account holder; the
  // phone number they deliver to is confirmed with a code before the order is
  // accepted, and that is all that is asked of them.
  const shopper = await getShopper();
  if (!shopper) redirect("/cart");

  const [verifiedPhone, settings] = await Promise.all([getVerifiedPhone(), getShopSettings()]);
  const payableWith = await availablePaymentMethods();

  // Buy Now checks out one line held in its own session; the cart is not read
  // at all, so nothing else the shopper had saved comes along.
  const query = await searchParams;
  const wantsBuyNow = (Array.isArray(query.mode) ? query.mode[0] : query.mode) === "buynow";
  const buyNow = wantsBuyNow ? await getBuyNowLine(shopper.id) : null;

  // A session that has expired or been spent falls back to the cart rather
  // than dead-ending on an empty checkout.
  const items = buyNow ? [] : await getCartItems(shopper.id);
  if (!buyNow && items.length === 0) redirect("/cart");
  // A line whose combination has been retired cannot be bought, so checkout is
  // not somewhere to start: the shopper goes back to the cart, which says which
  // line it is and offers the button that removes it. Letting them fill in an
  // address first and find out at "Pay Now" would be the same refusal, later.
  if (!buyNow && items.some((item) => item.unavailable)) redirect("/cart");

  // Priced and locked the way `placeOrder` will judge them, so the wizard
  // cannot offer a choice the order would refuse.
  const subtotal = buyNow ? buyNow.price * buyNow.quantity : cartSubtotal(items);
  // Free on the products' own account when every line carries it -- one line
  // for Buy Now, all of them for a cart. `placeOrder` judges it again from the
  // database, so the wizard can only ever quote what the order will charge.
  const freeByProduct = buyNow ? buyNow.freeDelivery : cartFreeDelivery(items);
  const deliveryOptions = deliveryOptionsFor(subtotal, settings, freeByProduct);

  const addresses = shopper.isGuest ? [] : await getAddresses(shopper.id);
  const saved = addresses.find((address) => address.isDefault) ?? addresses[0] ?? null;
  // Phone-only accounts get their number as a display name, and guests are
  // called "Guest" - neither is something to prefill as the recipient's name.
  const accountName = shopper.isGuest || shopper.name.startsWith("+") ? "" : shopper.name;

  // An address saved before the picker existed holds a typed city and no
  // district, which is not a place an order can be sent to. Prefill the three
  // names only when together they name a real division -> district -> upazila;
  // half of a path would leave the shopper correcting a form that looks filled.
  const savedLocation = {
    division: saved?.city ?? "",
    district: saved?.district ?? "",
    area: saved?.area ?? "",
  };
  const usableLocation = isServedLocation(
    savedLocation.division,
    savedLocation.district,
    savedLocation.area
  );

  const initialDetails: DeliveryDetails = {
    fullName: saved?.fullName ?? accountName,
    phone: saved?.phone ?? shopper.phone ?? "",
    division: usableLocation ? savedLocation.division : "",
    district: usableLocation ? savedLocation.district : "",
    area: usableLocation ? savedLocation.area : "",
    addressDetails: saved?.line1 ?? "",
    // Home delivery is where checkout opens, whatever the order is worth.
    deliveryMethod: "home",
  };

  // "Started checkout", reported from both sides with one id so Meta counts
  // it once: from the browser, and from here for the shoppers whose browser
  // blocks the pixel.
  const checkoutLines = buyNow
    ? [{ productId: buyNow.productId, quantity: buyNow.quantity, price: buyNow.price }]
    : items.map((item) => ({ productId: item.productId, quantity: item.quantity, price: item.product.price }));
  const checkoutEventId = crypto.randomUUID();
  if (checkoutLines.length > 0) {
    const match = await requestMatchData().catch(() => null);
    if (match) {
      await afterResponse("meta initiate checkout", () =>
        sendServerEvent({
          name: "InitiateCheckout",
          eventId: checkoutEventId,
          value: subtotal,
          lines: checkoutLines,
          ...match,
        })
      );
    }
  }

  return (
    <>
      {checkoutLines.length > 0 ? (
        <PixelEvent
          event="InitiateCheckout"
          eventId={checkoutEventId}
          params={{
            content_ids: checkoutLines.map((line) => line.productId),
            contents: checkoutLines.map((line) => ({
              id: line.productId,
              quantity: line.quantity,
              item_price: line.price,
            })),
            content_type: "product",
            num_items: checkoutLines.reduce((sum, line) => sum + line.quantity, 0),
            currency: "BDT",
            value: subtotal,
          }}
        />
      ) : null}
      <CheckoutWizard
        key={shopper.id}
        initialDetails={initialDetails}
        verifiedPhone={verifiedPhone}
        source={buyNow ? "buynow" : "cart"}
        lines={
          buyNow
            ? [
                {
                  id: buyNow.sessionId,
                  name: buyNow.name,
                  image: buyNow.image,
                  color: buyNow.label || null,
                  quantity: buyNow.quantity,
                  price: buyNow.price,
                  oldPrice: buyNow.oldPrice,
                },
              ]
            : items.map((item) => ({
                id: item.id,
                name: item.product.name,
                image: item.product.image,
                color: item.color || null,
                quantity: item.quantity,
                price: item.product.price,
                oldPrice: item.product.oldPrice,
              }))
        }
        subtotal={subtotal}
        deliveryOptions={deliveryOptions}
        payableWith={payableWith}
      />
    </>
  );
}
