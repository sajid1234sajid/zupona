import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { getCurrentSeller } from "@/lib/sellers";
import { sellerUrl, storefrontOrigin } from "@/lib/panelUrl";
import SellerShell from "@/components/seller/SellerShell";

/** The gate.
 *
 * Every page inside this route group is behind these checks, so a new Seller
 * Center screen is protected the moment it is created rather than needing to
 * remember a guard. It is not the *only* check: server actions call
 * `requireApprovedSeller()` themselves, because a layout only guards rendering
 * and an action can be invoked directly.
 *
 * Each refusal sends the visitor somewhere they can act rather than to an
 * error: a signed-out visitor to the door, a seller without a store to the
 * application form, an applicant whose shop is not approved yet to the screen
 * that tells them so, and an admin who has not picked a shop to the list of
 * them. */
export default async function SellerPanelLayout({ children }: LayoutProps<"/seller/(panel)">) {
  const user = await getCurrentUser();
  if (!user) redirect(await sellerUrl("/seller/login"));

  const asAdmin = user.role === "admin";

  // The store and the storefront origin do not depend on each other, and the
  // database is in Singapore, so they are read in one wave rather than two.
  const [seller, storefront] = await Promise.all([getCurrentSeller(), storefrontOrigin()]);

  if (!seller) redirect(await sellerUrl(asAdmin ? "/seller/stores" : "/seller/apply"));

  // An admin is not held to approval: a shop still waiting on a decision is
  // the one they are most likely to have opened this panel to look at.
  if (!asAdmin && seller.status !== "approved") redirect(await sellerUrl("/seller/pending"));

  return (
    <SellerShell
      storeName={seller.storeName}
      storeStatus={seller.status}
      ownerName={user.name}
      storefrontUrl={storefront}
      asAdmin={asAdmin}
    >
      {children}
    </SellerShell>
  );
}
