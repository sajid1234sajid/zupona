/** The storefront's responsive frame.
 *
 * Every shop page used to open with `mx-auto max-w-md`, which pinned the site
 * to 448px however wide the screen was -- fine on a phone, a narrow ribbon on
 * a laptop. This replaces that: the page is full-width on a phone and centres
 * inside a readable measure once there is room for it.
 *
 * The switch happens at the `tab` breakpoint (700px, defined in globals.css),
 * which is also where the mobile tab bar and the sticky action bar go away.
 *
 * The pale mint ground lives here rather than on <body> on purpose. The admin
 * panel shares the same document, and it is meant to stay white. */

export default function StoreShell({
  children,
  /** Leaves room for the fixed tab bar so the last row can scroll clear of it.
   * Set false for pages that render no tab bar. */
  withTabBar = true,
  /** Extra room for a page that also pins an action bar above the tab bar
   * (the product page's Add to Cart / Buy Now row). */
  withStickyActions = false,
  className = "",
}: {
  children: React.ReactNode;
  withTabBar?: boolean;
  withStickyActions?: boolean;
  className?: string;
}) {
  const bottomPadding = withStickyActions
    ? "pb-[calc(140px+env(safe-area-inset-bottom))] tab:pb-0"
    : withTabBar
      ? "pb-[calc(72px+env(safe-area-inset-bottom))] tab:pb-0"
      : "";

  return (
    <div className={`flex min-h-screen w-full flex-col bg-surface ${bottomPadding} ${className}`}>
      {children}
    </div>
  );
}

/** The horizontal measure shared by every storefront section.
 *
 * Side padding is set once, here, so no child needs its own -- which is what
 * keeps content off the screen edge at 320px and stops a stray `padding`
 * shorthand from reintroducing an overflow. */
export function StoreContainer({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`mx-auto w-full max-w-shell px-3 tab:px-6 ${className}`}>{children}</div>
  );
}
