import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { getCartItems, cartSubtotal } from "@/lib/cart";
import { getBuyNowLine } from "@/lib/buyNow";
import { getAddresses } from "@/lib/addresses";
import { getVerifiedPhone } from "@/lib/verification";
import { divisionNames } from "@/data/locations";
import { deliveryMethodsWithFees, type DeliveryDetails } from "@/lib/checkout";
import { getDeliveryFees } from "@/lib/shopSettings";
import CheckoutWizard from "@/components/checkout/CheckoutWizard";

const EMPTY_DETAILS: DeliveryDetails = {
  fullName: "",
  phone: "",
  division: "",
  area: "",
  addressDetails: "",
  deliveryMethod: "standard",
};

export default async function CheckoutPage({ searchParams }: PageProps<"/checkout">) {
  const user = await getCurrentUser();
  const [verifiedPhone, fees] = await Promise.all([getVerifiedPhone(), getDeliveryFees()]);
  const pricedDelivery = deliveryMethodsWithFees(fees);

  // Signed-out shoppers get step 1 (the mobile-number login) instead of being
  // bounced to the login page, so checkout carries on where they left off.
  if (!user) {
    return (
      <CheckoutWizard
        key="guest"
        source="cart"
        signedIn={false}
        initialDetails={EMPTY_DETAILS}
        verifiedPhone={verifiedPhone}
        lines={[]}
        subtotal={0}
        deliveryMethods={pricedDelivery}
      />
    );
  }

  // Buy Now checks out one line held in its own session; the cart is not read
  // at all, so nothing else the shopper had saved comes along.
  const query = await searchParams;
  const wantsBuyNow = (Array.isArray(query.mode) ? query.mode[0] : query.mode) === "buynow";
  const buyNow = wantsBuyNow ? await getBuyNowLine(user.id) : null;

  // A session that has expired or been spent falls back to the cart rather
  // than dead-ending on an empty checkout.
  const items = buyNow ? [] : await getCartItems(user.id);
  if (!buyNow && items.length === 0) redirect("/cart");

  const addresses = await getAddresses(user.id);
  const saved = addresses.find((address) => address.isDefault) ?? addresses[0] ?? null;
  // Phone-only accounts get their number as a display name - not something to
  // prefill as the recipient's name.
  const accountName = user.name.startsWith("+") ? "" : user.name;

  const initialDetails: DeliveryDetails = {
    fullName: saved?.fullName ?? accountName,
    phone: saved?.phone ?? user.phone ?? "",
    division: saved && divisionNames.includes(saved.city) ? saved.city : "",
    area: saved?.area ?? "",
    addressDetails: saved?.line1 ?? "",
    deliveryMethod: "standard",
  };

  return (
    <CheckoutWizard
      key={user.id}
      signedIn
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
      subtotal={buyNow ? buyNow.price * buyNow.quantity : cartSubtotal(items)}
      deliveryMethods={pricedDelivery}
    />
  );
}
