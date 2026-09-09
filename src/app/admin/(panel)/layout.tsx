import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { getStaffAlerts } from "@/lib/adminData";
import { adminUrl, storefrontOrigin } from "@/lib/adminUrl";
import AdminShell from "@/components/admin/AdminShell";

/** The gate.
 *
 * Every page inside this route group is behind this check, so a new admin
 * screen is protected the moment it is created rather than needing to remember
 * a guard. It is not the *only* check: server actions call `requireAdmin()`
 * themselves, because a layout only guards rendering and an action can be
 * invoked directly.
 *
 * A signed-in shopper who reaches an admin URL is sent to the login screen
 * rather than told "forbidden" -- the panel does not confirm its own existence
 * to people who have no business there. */
export default async function PanelLayout({ children }: LayoutProps<"/admin/(panel)">) {
  const user = await getCurrentUser();

  if (!user || (user.role !== "admin" && user.role !== "support")) {
    redirect(await adminUrl("/admin/login"));
  }

  const [alerts, storefront] = await Promise.all([getStaffAlerts(), storefrontOrigin()]);

  return (
    <AdminShell
      adminName={user.name}
      adminEmail={user.email}
      avatarUrl={user.avatarUrl}
      alerts={alerts}
      storefrontUrl={storefront}
    >
      {children}
    </AdminShell>
  );
}
