import Link from "next/link";
import DesktopHeader from "@/components/layout/DesktopHeader";
import { Banknote, ChevronLeft, CreditCard, Smartphone } from "lucide-react";
import BottomNav from "@/components/layout/BottomNav";
import PaymentMethodsClient from "@/components/account/PaymentMethodsClient";
import { requireUser } from "@/lib/session";
import { getPaymentMethods } from "@/lib/paymentMethods";
import { acceptedPaymentProviders, type PaymentProvider } from "@/lib/payments";
import { listJoin } from "@/lib/policyFacts";

/** How this shopper can pay, as it really is today.
 *
 * The page used to invite them to "Save a card, mobile wallet, or choose cash
 * on delivery" while checkout took only cash. It now lists the methods
 * checkout accepts, from the same check checkout makes, and offers nothing to
 * add until there is something to add. Methods saved under the old page are
 * still shown so they can be removed. */
export default async function PaymentMethodsPage() {
  const user = await requireUser();
  const [methods, providers] = await Promise.all([
    getPaymentMethods(user.id),
    acceptedPaymentProviders().catch(() => [] as PaymentProvider[]),
  ]);
  const accepted = providers.length > 0 ? providers : [{ id: "cod", label: "Cash on Delivery", configured: true, online: false }];
  const comingSoon = ["bKash", "Nagad"].filter((name) => !accepted.some((p) => p.label === name));
  const icon = (id: string) => (id === "cod" ? Banknote : id === "card" ? CreditCard : Smartphone);

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col bg-brand-mist pb-20 tab:max-w-none tab:pb-12">
      <DesktopHeader />
      <header className="flex items-center gap-3 border-b border-line-soft bg-white px-4 py-3 tab:mx-auto tab:mt-6 tab:w-full tab:max-w-2xl tab:rounded-2xl tab:border">
        <Link href="/account" aria-label="Back to account">
          <ChevronLeft className="h-5 w-5 text-ink" />
        </Link>
        <h1 className="text-base font-bold text-heading">Payment Methods</h1>
      </header>
      <main className="flex-1 px-4 pt-4 tab:mx-auto tab:w-full tab:max-w-2xl tab:px-0">
        <section className="rounded-2xl bg-white p-4 shadow-card">
          <p className="text-[13.5px] text-ink">
            Currently we accept {listJoin(accepted.map((p) => p.label))}.
            {comingSoon.length > 0 ? ` ${listJoin(comingSoon)} ${comingSoon.length > 1 ? "are" : "is"} coming soon.` : ""}
          </p>
          <ul className="mt-3 space-y-2">
            {accepted.map((provider) => {
              const Icon = icon(provider.id);
              return (
                <li key={provider.id} className="flex items-center gap-3 rounded-xl border border-line-soft px-3 py-2.5">
                  <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-tint text-brand">
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="text-[13.5px] font-semibold text-heading">{provider.label}</span>
                  {provider.id === "cod" ? (
                    <span className="ml-auto text-[11.5px] text-ink-muted">Pay when it arrives</span>
                  ) : null}
                </li>
              );
            })}
          </ul>
          <p className="mt-3 text-[12px] text-ink-muted">
            Nothing needs to be saved here: you choose how to pay at checkout.
          </p>
        </section>

        {methods.length > 0 ? (
          <div className="mt-4">
            <h2 className="mb-2 text-sm font-bold text-heading">Saved earlier</h2>
            <PaymentMethodsClient methods={methods} />
          </div>
        ) : null}
      </main>
      <BottomNav />
    </div>
  );
}
