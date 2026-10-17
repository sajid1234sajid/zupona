import type { ReactNode } from "react";
import AccountShell from "@/components/account/AccountShell";

/** Every account page, with the account menu beside it on a wide screen. */
export default function AccountLayout({ children }: { children: ReactNode }) {
  return <AccountShell>{children}</AccountShell>;
}
