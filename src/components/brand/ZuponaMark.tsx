import Image from "next/image";

/** The Zupona mark -- the green swirl around a shopping cart.
 *
 * One component so the brand cannot drift between the storefront header and
 * the four checkout screens -- the reference designs show the same mark on
 * every one of them.
 *
 * The artwork is a cut-out PNG with a transparent background, so it is meant
 * to sit on white. On the dark surfaces (the phone header, the admin sidebar)
 * the call site puts it on a white tile rather than straight onto the dark,
 * because the white lines that separate the swirl's blades are transparent
 * too and would otherwise read as gaps. */
export default function ZuponaMark({ className = "" }: { className?: string }) {
  return (
    <Image
      src="/logo.png"
      alt=""
      aria-hidden
      // The mark is drawn between 22 px and 56 px, never larger. Declaring the
      // artwork's own 256 made next/image ask the optimizer for 640 -- 16 KB
      // of logo for a 22 px header icon, fetched at high priority on every
      // page. 64 puts the top of the srcSet at 128, which still covers the
      // largest use on a retina screen.
      width={64}
      height={64}
      className={className}
      priority
    />
  );
}
