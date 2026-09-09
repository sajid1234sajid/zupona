import { getCurrentUser } from "@/lib/session";
import { mapAuthError } from "@/lib/auth-errors";
import { getOrders } from "@/lib/orders";
import { getWishlistCount } from "@/lib/wishlist";
import { getUnreadNotificationCount } from "@/lib/notifications";
import AccountProfile from "@/components/account/AccountProfile";
import AuthScreen from "@/components/auth/AuthScreen";
import { signUpAction } from "./actions";

export default async function AccountPage(props: PageProps<"/account">) {
  const user = await getCurrentUser();

  if (user) {
    const [orders, wishlistCount, unreadCount] = await Promise.all([
      getOrders(user.id),
      getWishlistCount(user.id),
      getUnreadNotificationCount(user.id),
    ]);

    return (
      <AccountProfile
        user={user}
        latestOrder={orders[0] ?? null}
        orderCount={orders.length}
        wishlistCount={wishlistCount}
        unreadNotificationCount={unreadCount}
      />
    );
  }

  const searchParams = await props.searchParams;
  const errorParam = searchParams.error;
  const error = mapAuthError(typeof errorParam === "string" ? errorParam : undefined);

  return (
    <AuthScreen
      mode="signup"
      title="Create Your Zupona Account"
      subtitle="Get a personalized experience, track your orders, and save your favorites."
      action={signUpAction}
      initialError={error}
    />
  );
}
