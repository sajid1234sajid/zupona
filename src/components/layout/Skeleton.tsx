import BottomNavBar from "./BottomNavBar";

/** The pieces a `loading.tsx` is built from.
 *
 * Every storefront page reads the session, so none of them can be prerendered
 * and each tab was a silent wait: the tap changed nothing on screen until the
 * server answered, which on a phone reads as the app having missed the touch.
 * These stand in for the real thing in the meantime.
 *
 * Two rules keep the swap from looking like a second page load. A skeleton
 * carries the same chrome and the same spacing as the page it stands for, so
 * nothing jumps when the real content arrives; and it renders the real tab bar
 * rather than a drawing of one, so the tab the shopper just pressed lights up
 * immediately -- `BottomNavBar` reads the path, and the router has already
 * moved it by the time this renders. */

/** A grey block that breathes. `aria-hidden` throughout: a screen reader is
 * told the page is busy by the live region at the root of each skeleton, and
 * should not be read a wall of empty boxes. */
export function Bone({ className = "" }: { className?: string }) {
  return <span aria-hidden className={`block animate-pulse rounded bg-brand-mist ${className}`} />;
}

/** Stands in for `ProductHeader` -- the brand lockup and the three icons. */
export function HeaderBone() {
  return (
    <header className="flex items-center justify-between border-b border-line-soft bg-white px-4 py-3">
      <span className="flex items-center gap-2">
        <Bone className="h-9 w-9 rounded-lg" />
        <span className="flex flex-col gap-1">
          <Bone className="h-[15px] w-[84px]" />
          <Bone className="h-[9px] w-[104px]" />
        </span>
      </span>
      <span className="flex items-center gap-4">
        <Bone className="h-5 w-5 rounded-full" />
        <Bone className="h-5 w-5 rounded-full" />
        <Bone className="h-5 w-5 rounded-full" />
      </span>
    </header>
  );
}

/** A grid of product tiles in the same two-column shape the real grid uses. */
export function ProductGridBone({ count = 6 }: { count?: number }) {
  return (
    <div className="mt-2 grid grid-cols-2 gap-1.5 tab:mt-4 tab:grid-cols-3 tab:gap-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="overflow-hidden rounded-xl border border-line bg-white">
          <Bone className="aspect-square w-full rounded-none" />
          <div className="flex flex-col gap-1.5 p-2">
            <Bone className="h-[10px] w-[88%]" />
            <Bone className="h-[10px] w-[60%]" />
            <Bone className="mt-0.5 h-[13px] w-[52%]" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** The frame every tab's skeleton sits in: chrome, content, real tab bar.
 *
 * `cartCount={0}` because the count belongs to the page being fetched. The
 * badge is the one thing that appears a moment late; the alternative is
 * holding the whole screen back for it, which is what this exists to stop. */
export function SkeletonShell({
  children,
  className = "bg-white",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Loading"
      className={`mx-auto flex min-h-screen w-full max-w-md flex-col pb-[68px] tab:max-w-none tab:pb-12 ${className}`}
    >
      <HeaderBone />
      <main className="flex-1 tab:mx-auto tab:w-full tab:max-w-shell tab:px-6 tab:pt-5">
        {children}
      </main>
      <BottomNavBar cartCount={0} />
    </div>
  );
}
