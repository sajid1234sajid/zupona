import Link from "next/link";
import { Package, Search, ShoppingCart, User } from "lucide-react";
import { searchEverything } from "@/lib/adminData";
import { Avatar, Card, CardHeader, EmptyState, PageHeader, Thumb } from "@/components/admin/ui";

export const metadata = { title: "Search" };

const SECTIONS = [
  { kind: "product" as const, title: "Products", icon: Package },
  { kind: "order" as const, title: "Orders", icon: ShoppingCart },
  { kind: "customer" as const, title: "Customers", icon: User },
];

export default async function AdminSearchPage(props: PageProps<"/admin/search">) {
  const searchParams = await props.searchParams;
  const raw = searchParams.q;
  const query = (Array.isArray(raw) ? raw[0] : raw)?.trim() ?? "";

  const hits = query ? await searchEverything(query) : [];

  return (
    <>
      <PageHeader
        title={query ? `Results for “${query}”` : "Search"}
        subtitle={
          query
            ? `${hits.length} match${hits.length === 1 ? "" : "es"} across products, orders and customers`
            : "Search products, orders and customers from the bar above"
        }
        breadcrumb={["Search"]}
      />

      {!query ? (
        <Card>
          <EmptyState
            title="Type something to search"
            detail="Product names and SKUs, order numbers, customer names, emails and phone numbers all work."
          />
        </Card>
      ) : hits.length === 0 ? (
        <Card>
          <EmptyState
            title={`Nothing matches “${query}”`}
            detail="Check the spelling, or try part of an order number instead of the whole thing."
          />
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          {SECTIONS.map((section) => {
            const rows = hits.filter((hit) => hit.kind === section.kind);
            return (
              <Card key={section.kind}>
                <CardHeader
                  title={section.title}
                  subtitle={`${rows.length} match${rows.length === 1 ? "" : "es"}`}
                />
                {rows.length === 0 ? (
                  <p className="flex items-center justify-center gap-2 py-8 text-sm text-neutral-400">
                    <Search className="h-4 w-4" />
                    No matches here.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {rows.map((hit) => (
                      <li key={`${hit.kind}-${hit.id}`}>
                        <Link
                          href={hit.href}
                          className="flex items-center gap-2.5 rounded-xl border border-neutral-100 px-3 py-2.5 transition hover:border-brand/30 hover:bg-brand-tint/40"
                        >
                          {hit.kind === "customer" ? (
                            <Avatar src={hit.image} name={hit.title} size={34} />
                          ) : hit.kind === "product" ? (
                            <Thumb src={hit.image} alt="" size={34} />
                          ) : (
                            <span className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-lg bg-brand-tint">
                              <section.icon className="h-4 w-4 text-brand-dark" />
                            </span>
                          )}
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[13px] font-semibold text-neutral-800">
                              {hit.title}
                            </span>
                            <span className="block truncate text-[11px] text-neutral-400">
                              {hit.detail}
                            </span>
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
