/** The success mark on the order-confirmed screen.
 *
 * A pale mint halo, a bright green disc and a plain heavy check -- the
 * reference uses a bare checkmark rather than a circled-check glyph, so the
 * disc is the only circle. The flecks around it are the reference's confetti,
 * kept to ten marks and drawn from tokens that already exist (the brand greens
 * and the rating gold) so the screen introduces no colour of its own.
 *
 * Decorative, and hidden from assistive technology: the heading below it is
 * what announces the outcome. */
export default function SuccessBurst() {
  return (
    <div className="relative flex h-[104px] w-[168px] items-center justify-center">
      <svg
        aria-hidden
        viewBox="0 0 168 104"
        className="absolute inset-0 h-full w-full"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <g
          stroke="var(--color-brand-light)"
          strokeWidth="3.5"
          strokeLinecap="round"
          opacity="0.85"
        >
          <path d="M31 26 L38 33" />
          <path d="M137 26 L130 33" />
          <path d="M24 58 L33 56" />
        </g>
        <g stroke="var(--color-gold)" strokeWidth="3.5" strokeLinecap="round" opacity="0.9">
          <path d="M46 14 L49 22" />
          <path d="M122 14 L119 22" />
          <path d="M144 54 L135 52" />
        </g>
        <g fill="var(--color-brand-leaf)">
          <path d="M40 74 C40 68 45 63 52 63 C52 70 47 75 40 74 Z" />
          <path d="M128 74 C128 68 123 63 116 63 C116 70 121 75 128 74 Z" />
        </g>
        <g fill="var(--color-brand-light)" opacity="0.7">
          <circle cx="58" cy="8" r="2.5" />
          <circle cx="110" cy="8" r="2.5" />
        </g>
      </svg>

      <span className="relative flex h-[88px] w-[88px] items-center justify-center rounded-full bg-brand-tint">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-light">
          <svg
            aria-hidden
            viewBox="0 0 24 24"
            className="h-7 w-7"
            fill="none"
            stroke="#ffffff"
            strokeWidth="3.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M4.5 12.5 L9.5 17.5 L19.5 7" />
          </svg>
        </span>
      </span>
    </div>
  );
}
