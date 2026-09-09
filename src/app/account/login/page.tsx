import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { mapAuthError } from "@/lib/auth-errors";
import AuthScreen from "@/components/auth/AuthScreen";
import { logInAction } from "../actions";

export default async function LoginPage(props: PageProps<"/account/login">) {
  const user = await getCurrentUser();
  if (user) {
    redirect("/account");
  }

  const searchParams = await props.searchParams;
  const errorParam = searchParams.error;
  const error = mapAuthError(typeof errorParam === "string" ? errorParam : undefined);

  return (
    <AuthScreen
      mode="login"
      title="Welcome Back"
      subtitle="Login to continue shopping with Zupona."
      action={logInAction}
      initialError={error}
    />
  );
}
