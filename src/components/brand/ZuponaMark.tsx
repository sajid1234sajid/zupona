/** The Zupona shopping-bag-and-leaf mark.
 *
 * One component so the brand cannot drift between the storefront header and
 * the four checkout screens -- the reference designs show the same mark on
 * every one of them. Colours come from the brand tokens. */
export default function ZuponaMark({ className = "" }: { className?: string }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 48 48"
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* the bag handle */}
      <path
        d="M17 16 V13 C17 8.6 20.1 5.5 24 5.5 C27.9 5.5 31 8.6 31 13 V16"
        stroke="var(--color-brand-dark)"
        strokeWidth="3.2"
        strokeLinecap="round"
      />
      {/* the bag body */}
      <path
        d="M9.5 16 H38.5 L36.2 40.5 C36 42.6 34.3 44.2 32.2 44.2 H15.8 C13.7 44.2 12 42.6 11.8 40.5 Z"
        fill="var(--color-brand-dark)"
      />
      {/* the leaf across it */}
      <path
        d="M23 38 C16.5 38 12 33.2 12 26.5 C20 25.4 25.4 29.7 23 38 Z"
        fill="var(--color-brand-light)"
      />
      <path d="M25 38 C25 28.5 30.2 22.6 38.5 21.5 C39 31.6 33.5 37.6 25 38 Z" fill="var(--color-brand-leaf-bright)" />
      <path
        d="M24 39.5 C24.6 33 27.8 27.5 33 24"
        stroke="var(--color-brand-dark)"
        strokeWidth="1.6"
        strokeLinecap="round"
        opacity="0.55"
      />
    </svg>
  );
}
