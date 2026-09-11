/** The illustration beside "Let's get started" on checkout step 1.
 *
 * Drawn rather than imported: it has to sit on the checkout's mint background
 * at any size without a raster edge showing, and it uses the brand tokens
 * directly so it can never drift from the rest of the palette. Purely
 * decorative, so it is hidden from assistive technology. */
export default function PhoneShieldArt({ className = "" }: { className?: string }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 132 132"
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* the pale disc the phone sits on */}
      <circle cx="72" cy="62" r="44" fill="var(--color-brand-tint)" />

      {/* sparkle lines, radiating from the top-left corner of the phone */}
      <g stroke="var(--color-brand-light)" strokeWidth="3.2" strokeLinecap="round">
        <path d="M31 34 L20 25" />
        <path d="M26 49 L13 46" />
        <path d="M37 22 L33 10" />
        <path d="M52 16 L54 6" />
      </g>

      {/* phone body */}
      <rect x="40" y="18" width="60" height="94" rx="12" fill="var(--color-brand-darkest)" />
      <rect x="45" y="24" width="50" height="82" rx="8" fill="#ffffff" />

      {/* shield with its tick */}
      <path
        d="M70 44 L84 49.5 V63.5 C84 72.6 77.9 80.4 70 83 C62.1 80.4 56 72.6 56 63.5 V49.5 Z"
        fill="var(--color-brand-light)"
      />
      <path
        d="M63.5 63.5 L68 68 L77 58.5"
        stroke="#ffffff"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* leaves tucked behind the phone, left and right */}
      <g fill="var(--color-brand-light)" opacity="0.9">
        <path d="M38 96 C24 96 15 87 15 75 C29 74 38 82 38 96 Z" />
        <path d="M36 108 C24 110 14 104 11 94 C24 90 33 96 36 108 Z" opacity="0.75" />
      </g>
      <g fill="var(--color-brand)" opacity="0.85">
        <path d="M102 92 C116 92 125 83 125 71 C111 70 102 78 102 92 Z" />
        <path d="M104 106 C116 108 126 101 128 91 C115 88 107 94 104 106 Z" opacity="0.75" />
      </g>
    </svg>
  );
}
