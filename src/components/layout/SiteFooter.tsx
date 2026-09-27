import Link from "next/link";

/** The one thing every storefront page ends on: a way to find the return and
 * refund policy without having to already be on a product page. Sits above
 * the tab bar, same as the rest of a page's content, so it scrolls into view
 * rather than fighting the fixed bar for space. */
export default function SiteFooter() {
  return (
    <footer className="mt-8 border-t border-line-soft px-4 py-5 text-center tab:mx-auto tab:w-full tab:max-w-shell tab:px-6">
      <Link
        href="/returns-policy"
        className="text-[12px] font-semibold text-brand hover:text-brand-darkest"
      >
        Return &amp; Refund Policy
      </Link>
      <p className="mt-2 text-[10.5px] text-ink-faint">
        &copy; {new Date().getFullYear()} Zupona. All rights reserved.
      </p>
    </footer>
  );
}
