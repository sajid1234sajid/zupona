import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { getCartItems, cartSubtotal } from "@/lib/cart";
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

export default async function CheckoutPage() {
  const user = await getCurrentUser();
  const [verifiedPhone, fees] = await Promise.all([getVerifiedPhone(), getDeliveryFees()]);
  const pricedDelivery = deliveryMethodsWithFees(fees);

  // Signed-out shoppers get step 1 (the mobile-number login) instead of being
  // bounced to the login page, so checkout carries on where they left off.
  if (!user) {
    return (
      <CheckoutWizard
        key="guest"
        signedIn={false}
        initialDetails={EMPTY_DETAILS}
        verifiedPhone={verifiedPhone}
        lines={[]}
        subtotal={0}
        deliveryMethods={pricedDelivery}
      />
    );
  }

  const items = await getCartItems(user.id);
  if (items.length === 0) redirect("/cart");

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
      lines={items.map((item) => ({
        id: item.id,
        name: item.product.name,
        image: item.product.image,
        color: item.color || null,
        quantity: item.quantity,
        price: item.product.price,
        oldPrice: item.product.oldPrice,
      }))}
      subtotal={cartSubtotal(items)}
      deliveryMethods={pricedDelivery}
    />
  );
}
