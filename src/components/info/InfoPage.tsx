import type { ReactNode } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import ProductHeader from "@/components/layout/ProductHeader";
import DesktopHeader from "@/components/layout/DesktopHeader";
import BottomNav from "@/components/layout/BottomNav";
import SiteFooter from "@/components/layout/SiteFooter";
import { INFO_LINKS } from "./links";

/** The frame every help and policy page sits in.
 *
 * The same headers, footer and tab bar as the rest of the shop, a breadcrumb,
 * and -- from the `tab` breakpoint up -- the list of the other help pages down
 * the left, so a shopper who came for the returns policy can see that a
 * shipping page and a support center exist without going back to the footer.
 *
 * `updated` is the date the page's wording last changed, shown under the
 * title. Policy pages carry one because a policy without a date cannot be
 * held to anything. */
export default function InfoPage({
  path,
  title,
  intro,
  updated,
  children,
  wide = false,
}: {
  /** This page's own path, to mark it in the side list. */
  path: string;
  title: string;
  intro?: ReactNode;
  /** `YYYY-MM-DD`. */
  updated?: string;
  children: ReactNode;
  /** Let the content use the full width instead of a reading column. */
  wide?: boolean;
}) {
  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col bg-white pb-[68px] tab:max-w-none tab:pb-0">
      <div className="tab:hidden">
        <ProductHeader />
      </div>
      <DesktopHeader />
      <main className="flex-1 px-4 pt-3 tab:mx-auto tab:w-full tab:max-w-shell tab:px-6 tab:pt-5">
        <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-[11.5px] text-ink-muted">
          <Link href="/" className="hover:text-brand-darkest">
            Home
          </Link>
          <ChevronRight className="h-3 w-3" strokeWidth={2.5} />
          <span className="text-ink">{title}</span>
        </nav>

        <div className="tab:mt-4 tab:grid tab:grid-cols-[220px_1fr] tab:gap-10">
          <aside className="hidden tab:block">
            <h2 className="text-[11px] font-bold uppercase tracking-wide text-ink-faint">
              Help &amp; policies
            </h2>
            <ul className="mt-2 space-y-0.5">
              {INFO_LINKS.map((link) => {
                const active = link.href === path;
                return (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      prefetch={false}
                      aria-current={active ? "page" : undefined}
                      className={`block rounded-lg px-3 py-2 text-[13px] font-medium ${
                        active
                          ? "bg-brand-tint text-brand-dark"
                          : "text-ink-muted hover:bg-brand-mist hover:text-brand-darkest"
                      }`}
                    >
                      {link.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </aside>

          <article className={`pt-3 tab:pt-0 ${wide ? "" : "max-w-[720px]"}`}>
            <h1 className="text-xl font-bold text-heading tab:text-[28px] tab:leading-tight">
              {title}
            </h1>
            {updated ? (
              <p className="mt-1 text-[11.5px] text-ink-faint">
                Last updated{" "}
                {new Date(`${updated}T00:00:00Z`).toLocaleDateString("en-GB", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                  timeZone: "UTC",
                })}
              </p>
            ) : null}
            {intro ? (
              <p className="mt-2 text-[13.5px] leading-relaxed text-ink-slate tab:text-[15px]">
                {intro}
              </p>
            ) : null}
            <div className="mt-5">{children}</div>
          </article>
        </div>
      </main>
      <SiteFooter />
      <BottomNav />
    </div>
  );
}

/** A titled block of policy text. */
export function Section({ id, title, children }: { id?: string; title: string; children: ReactNode }) {
  return (
    <section id={id} className="mt-6 first:mt-0 scroll-mt-24">
      <h2 className="text-[15px] font-bold text-heading tab:text-[17px]">{title}</h2>
      <div className="mt-1.5 space-y-2 text-[13.5px] leading-relaxed text-ink-slate tab:text-[14.5px] [&_a]:font-semibold [&_a]:text-brand [&_a]:underline-offset-2 hover:[&_a]:underline [&_li]:ml-4 [&_li]:list-disc [&_li]:pl-1 [&_strong]:text-ink [&_ul]:space-y-1">
        {children}
      </div>
    </section>
  );
}
