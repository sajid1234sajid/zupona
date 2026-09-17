import { redirect } from "next/navigation";
import { getShopper } from "@/lib/session";
import { getCartItems, cartSubtotal } from "@/lib/cart";
import { getBuyNowLine } from "@/lib/buyNow";
import { getAddresses } from "@/lib/addresses";
import { getVerifiedPhone } from "@/lib/verification";
import { isServedLocation } from "@/data/locations";
import { getDeliveryMethod, type DeliveryDetails } from "@/lib/checkout";
import { availablePaymentMethods } from "@/lib/payments";
import { getShopSettings, shippingFeeFor } from "@/lib/shopSettings";
import CheckoutWizard from "@/components/checkout/CheckoutWizard";

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

  // Priced the way `placeOrder` will price it -- free-shipping threshold and
  // all -- so the wizard never quotes a charge the order does not carry.
  const subtotal = buyNow ? buyNow.price * buyNow.quantity : cartSubtotal(items);
  const delivery = getDeliveryMethod("standard", shippingFeeFor(subtotal, settings));

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
  };

  return (
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
      delivery={delivery}
      payableWith={payableWith}
    />
  );
}
