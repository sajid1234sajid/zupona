import Link from "next/link";
import DesktopHeader from "@/components/layout/DesktopHeader";
import { ChevronLeft, Gift, MessageSquareText, Minus, Plus, ShoppingBag, Star, Ticket } from "lucide-react";
import { requireUser } from "@/lib/session";
import { pointsHistory, pointsToTaka, type PointsEntry } from "@/lib/points";
import { getShopSettings } from "@/lib/shopSettings";
import { formatPrice, SHOP_TIME_ZONE } from "@/lib/format";

/** What a ledger row says to the shopper. */
function describe(entry: PointsEntry): string {
  const order = entry.orderNumber ? ` ${entry.orderNumber}` : "";
  switch (entry.reason) {
    case "order":
      return `Order${order}`;
    case "review":
      return "Review reward";
    case "redeem":
      return `Used on order${order}`;
    case "reverse":
      return entry.note ?? "Order cancelled";
    case "signup":
      return "Welcome bonus";
    case "expire":
      return "Expired";
    default:
      return entry.note ?? "Adjustment";
  }
}

const ICONS = { order: ShoppingBag, review: MessageSquareText, redeem: Ticket, signup: Gift } as const;

export default async function PointsPage() {
  const user = await requireUser();
  const [history, settings] = await Promise.all([pointsHistory(user.id), getShopSettings()]);
  const worth = pointsToTaka(user.points, settings.pointValue);

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col bg-brand-mist pb-10 tab:max-w-none tab:pb-12">
      <DesktopHeader />
      <header className="flex items-center gap-3 border-b border-line-soft bg-white px-4 py-3 tab:mx-auto tab:mt-6 tab:w-full tab:max-w-2xl tab:rounded-2xl tab:border">
        <Link href="/account" aria-label="Back to account">
          <ChevronLeft className="h-5 w-5 text-ink" />
        </Link>
        <h1 className="text-base font-bold text-heading">Zupona Points</h1>
      </header>
      <main className="flex-1 px-4 pt-4 tab:mx-auto tab:w-full tab:max-w-2xl tab:px-0">
        <div className="rounded-2xl bg-brand-darkest p-5 text-white">
          <p className="text-xs text-brand-tint">Your balance</p>
          <div className="mt-1 flex items-center gap-2">
            <Star className="h-6 w-6 fill-gold text-gold" />
            <span className="text-3xl font-bold">{user.points.toLocaleString("en-US")}</span>
            <span className="text-sm text-brand-tint">pts</span>
            {settings.pointValue > 0 ? (
              <span className="ml-auto rounded-full bg-white/10 px-3 py-1 text-sm font-semibold">
                ≈ {formatPrice(worth)}
              </span>
            ) : null}
          </div>
        </div>

        <div className="mt-3 grid grid-cols-1 gap-3 tab:grid-cols-2">
          <div className="rounded-2xl bg-white p-4 shadow-card">
            <h2 className="text-sm font-bold text-heading">How to earn</h2>
            <ul className="mt-2 space-y-1.5 text-[12.5px] text-ink-slate">
              <li>1 point for every ৳50 you spend, added when your order is delivered.</li>
              {settings.reviewPoints > 0 ? (
                <li>
                  {settings.reviewPoints} points for a written review
                  {settings.reviewPhotoPoints > 0 ? `, +${settings.reviewPhotoPoints} with a photo` : ""}.{" "}
                  <Link href="/account/reviews" className="font-semibold text-brand">
                    Review now
                  </Link>
                </li>
              ) : null}
            </ul>
          </div>
          <div className="rounded-2xl bg-white p-4 shadow-card">
            <h2 className="text-sm font-bold text-heading">How to use</h2>
            <ul className="mt-2 space-y-1.5 text-[12.5px] text-ink-slate">
              <li>
                At checkout, switch on “Use points”. 1 point = ৳{settings.pointValue.toLocaleString("en-US")}.
              </li>
              <li>
                Points can pay up to {settings.pointsMaxPercent}% of your items, from{" "}
                {settings.pointsMinRedeem} points.
              </li>
              <li>Points from a cancelled order are given back.</li>
            </ul>
          </div>
        </div>

        <h2 className="mb-2 mt-5 text-sm font-bold text-heading">History</h2>
        {history.length === 0 ? (
          <p className="text-xs text-ink-slate">Place an order to start earning points.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {history.map((entry) => {
              const Icon = ICONS[entry.reason as keyof typeof ICONS] ?? (entry.delta >= 0 ? Plus : Minus);
              return (
                <li key={entry.id} className="flex items-center gap-3 rounded-2xl bg-white p-4 shadow-card">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-tint text-brand">
                    <Icon className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-heading">{describe(entry)}</p>
                    <p className="text-xs text-ink-slate">
                      {new Date(`${entry.createdAt.replace(" ", "T")}Z`).toLocaleDateString("en-US", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                        timeZone: SHOP_TIME_ZONE,
                      })}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 text-sm font-bold ${entry.delta >= 0 ? "text-brand" : "text-accent-red"}`}
                  >
                    {entry.delta >= 0 ? "+" : ""}
                    {entry.delta} pts
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </div>
  );
}
