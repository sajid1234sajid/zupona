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
      width={256}
      height={256}
      className={className}
      priority
    />
  );
}
