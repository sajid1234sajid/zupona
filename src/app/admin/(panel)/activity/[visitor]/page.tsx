import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Phone, UserRound } from "lucide-react";
import { getVisitorDetail, sourceLabel } from "@/lib/activityData";
import { SHOP_TIME_ZONE, formatDateTime, formatPrice, parseDbDate } from "@/lib/format";
import { EventPill, EventSubject } from "@/components/admin/ActivityParts";
import { Avatar, Card, CardHeader, PageHeader, buttonStyles } from "@/components/admin/ui";

export const metadata = { title: "Visitor activity" };

function dayOf(value: string): string {
  const date = parseDbDate(value);
  if (!date) return "";
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: SHOP_TIME_ZONE,
  });
}

function timeOf(value: string): string {
  const date = parseDbDate(value);
  if (!date) return "";
  return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: SHOP_TIME_ZONE });
}

export default async function VisitorActivityPage(props: PageProps<"/admin/activity/[visitor]">) {
  const { visitor } = await props.params;
  const detail = await getVisitorDetail(decodeURIComponent(visitor));
  if (!detail) notFound();

  const { person, events } = detail;
  const count = (names: string[]) => events.filter((row) => names.includes(row.event)).length;
  const orders = events.filter((row) => row.event === "purchase");
  const spent = orders.reduce((sum, row) => sum + (row.value ?? 0), 0);

  // Grouped by the shop's day, newest first, the way the rows already are.
  const days: { day: string; rows: typeof events }[] = [];
  for (const row of events) {
    const day = dayOf(row.createdAt);
    const last = days[days.length - 1];
    if (last && last.day === day) last.rows.push(row);
    else days.push({ day, rows: [row] });
  }

  const facts = [
    { label: "Came from", value: `${sourceLabel(person.source)}${person.referrer ? ` (${person.referrer})` : ""}` },
    ...(person.campaign ? [{ label: "Campaign", value: person.campaign }] : []),
    { label: "Device", value: detail.devices.join(", ") || "—" },
    { label: "First seen", value: formatDateTime(detail.firstSeen) },
    { label: "Last seen", value: formatDateTime(detail.lastSeen) },
    ...(detail.visitorIds.length > 1 ? [{ label: "Browsers", value: String(detail.visitorIds.length) }] : []),
  ];

  const tallies = [
    { label: "Pages", value: count(["page_view", "product_view", "cart_view", "checkout"]) },
    { label: "Products viewed", value: count(["product_view"]) },
    { label: "Added to cart", value: count(["add_to_cart", "buy_now"]) },
    { label: "Orders", value: orders.length },
  ];

  return (
    <>
      <PageHeader
        title={person.name}
        subtitle={person.known ? "Everything this shopper did on Zupona" : "Not identified yet: no sign-in and no order"}
        breadcrumb={["Activity", person.name]}
        action={
          <Link href="/admin/activity" className={buttonStyles.secondary}>
            <ArrowLeft className="h-4 w-4" />
            Back
          </Link>
        }
      />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <div className="space-y-4 xl:col-span-4">
          <Card>
            <div className="flex items-center gap-3">
              <Avatar name={person.known ? person.name : ""} size={48} />
              <div className="min-w-0">
                <p className="truncate text-base font-bold text-neutral-800">{person.name}</p>
                {person.phone ? (
                  <a href={`tel:${person.phone}`} className="flex items-center gap-1 text-sm text-brand hover:underline">
                    <Phone className="h-3.5 w-3.5" />
                    {person.phone}
                  </a>
                ) : (
                  <p className="text-sm text-neutral-400">No phone number yet</p>
                )}
              </div>
            </div>

            {person.customerId ? (
              <Link
                href={`/admin/customers/${person.customerId}`}
                className={`${buttonStyles.secondary} mt-4 w-full justify-center`}
              >
                <UserRound className="h-4 w-4" />
                Customer profile
              </Link>
            ) : null}

            <dl className="mt-4 space-y-2.5 border-t border-neutral-100 pt-4">
              {facts.map((fact) => (
                <div key={fact.label} className="flex items-baseline justify-between gap-3 text-[13px]">
                  <dt className="shrink-0 text-neutral-400">{fact.label}</dt>
                  <dd className="min-w-0 truncate text-right font-medium text-neutral-700">{fact.value}</dd>
                </div>
              ))}
            </dl>
          </Card>

          <Card>
            <div className="grid grid-cols-2 gap-3">
              {tallies.map((tally) => (
                <div key={tally.label} className="rounded-xl bg-neutral-50 px-3 py-2.5">
                  <p className="text-lg font-bold text-neutral-800">{tally.value}</p>
                  <p className="text-[11px] text-neutral-500">{tally.label}</p>
                </div>
              ))}
            </div>
            {spent > 0 ? (
              <p className="mt-3 text-[13px] text-neutral-600">
                Spent <span className="font-semibold text-neutral-800">{formatPrice(spent)}</span> in this history
              </p>
            ) : null}
          </Card>
        </div>

        <Card className="xl:col-span-8">
          <CardHeader title="Timeline" subtitle={`${events.length} things recorded, newest first`} />
          <div className="space-y-5">
            {days.map((group) => (
              <section key={group.day}>
                <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-neutral-400">{group.day}</h3>
                <ol className="relative space-y-2 border-l border-neutral-100 pl-4">
                  {group.rows.map((row) => (
                    <li key={row.id} className="relative flex min-w-0 flex-wrap items-center gap-2">
                      <span className="absolute -left-[21px] top-2 h-2 w-2 rounded-full bg-neutral-300" />
                      <span className="w-16 shrink-0 text-[11px] text-neutral-400">{timeOf(row.createdAt)}</span>
                      <EventPill event={row.event} />
                      <span className="min-w-0 flex-1">
                        <EventSubject row={row} />
                      </span>
                    </li>
                  ))}
                </ol>
              </section>
            ))}
          </div>
        </Card>
      </div>
    </>
  );
}
