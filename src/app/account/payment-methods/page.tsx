import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import BottomNav from "@/components/layout/BottomNav";
import PaymentMethodsClient from "@/components/account/PaymentMethodsClient";
import { requireUser } from "@/lib/session";
import { getPaymentMethods } from "@/lib/paymentMethods";

export default async function PaymentMethodsPage() {
  const user = await requireUser();
  const methods = await getPaymentMethods(user.id);

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col bg-brand-mist pb-20">
      <header className="flex items-center gap-3 border-b border-line-soft bg-white px-4 py-3">
        <Link href="/account" aria-label="Back to account">
          <ChevronLeft className="h-5 w-5 text-ink" />
        </Link>
        <h1 className="text-base font-bold text-heading">Payment Methods</h1>
      </header>
      <main className="flex-1 px-4 pt-4">
        <PaymentMethodsClient methods={methods} />
      </main>
      <BottomNav />
    </div>
  );
}
