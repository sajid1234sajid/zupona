import Link from "next/link";
import DesktopHeader from "@/components/layout/DesktopHeader";
import { ChevronLeft } from "lucide-react";
import BottomNav from "@/components/layout/BottomNav";
import AddressesClient from "@/components/account/AddressesClient";
import { requireUser } from "@/lib/session";
import { getAddresses } from "@/lib/addresses";

export default async function AddressesPage() {
  const user = await requireUser();
  const addresses = await getAddresses(user.id);

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col bg-brand-mist pb-20 tab:max-w-none tab:pb-12">
      <DesktopHeader />
      <header className="flex items-center gap-3 border-b border-line-soft bg-white px-4 py-3 tab:mx-auto tab:mt-6 tab:w-full tab:max-w-2xl tab:rounded-2xl tab:border">
        <Link href="/account" aria-label="Back to account">
          <ChevronLeft className="h-5 w-5 text-ink" />
        </Link>
        <h1 className="text-base font-bold text-heading">Saved Addresses</h1>
      </header>
      <main className="flex-1 px-4 pt-4 tab:mx-auto tab:w-full tab:max-w-2xl tab:px-0">
        <AddressesClient addresses={addresses} />
      </main>
      <BottomNav />
    </div>
  );
}
