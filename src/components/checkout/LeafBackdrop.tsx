/** The backdrop every checkout screen shares: a soft wash, a pale wave along
 * the bottom edge, and leaf sprigs in the bottom corners.
 *
 * Drawn rather than imported for the same reason as the step-1 illustration --
 * it has to scale to any screen height without an edge showing, and it reads
 * its greens from the brand tokens so the five screens cannot drift apart.
 * Decorative only, and hidden from assistive technology. */

function LeafSprig({ className, flip = false }: { className: string; flip?: boolean }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 120 100"
      className={className}
      style={flip ? { transform: "scaleX(-1)" } : undefined}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* stem */}
      <path
        d="M8 96 C34 88 58 70 78 44"
        stroke="var(--color-brand-light)"
        strokeWidth="2.5"
        strokeLinecap="round"
        opacity="0.55"
      />
      {/* three leaves along it, largest at the tip */}
      <path
        d="M78 44 C78 26 90 12 108 10 C110 28 98 42 78 44 Z"
        fill="var(--color-brand-light)"
        opacity="0.45"
      />
      <path
        d="M52 66 C48 50 56 34 72 28 C77 44 69 60 52 66 Z"
        fill="var(--color-brand)"
        opacity="0.3"
      />
      <path
        d="M24 86 C16 72 20 55 34 46 C42 60 38 77 24 86 Z"
        fill="var(--color-brand-light)"
        opacity="0.35"
      />
    </svg>
  );
}

export default function LeafBackdrop() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* the diffuse wash, as before */}
      <span className="absolute -top-20 -right-20 h-56 w-56 rounded-full bg-brand-light/15 blur-3xl" />
      <span className="absolute top-1/3 -left-24 h-56 w-56 rounded-full bg-brand/10 blur-3xl" />

      {/* the pale wave the references carry along the bottom edge */}
      <svg
        viewBox="0 0 390 120"
        preserveAspectRatio="none"
        className="absolute inset-x-0 bottom-0 h-32 w-full"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M0 62 C70 30 128 92 200 66 C262 44 320 76 390 52 L390 120 L0 120 Z"
          fill="var(--color-brand-tint)"
          opacity="0.75"
        />
        <path
          d="M0 86 C84 58 140 106 214 84 C274 66 330 96 390 78 L390 120 L0 120 Z"
          fill="var(--color-brand-tint)"
        />
      </svg>

      <LeafSprig className="absolute -left-4 bottom-0 h-28 w-32" />
      <LeafSprig className="absolute -right-4 bottom-2 h-32 w-36" flip />
    </div>
  );
}
