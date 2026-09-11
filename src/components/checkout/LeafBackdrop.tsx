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
        stroke="var(--color-brand-leaf)"
        strokeWidth="2.5"
        strokeLinecap="round"
        opacity="0.9"
      />
      {/* three leaves along it, largest at the tip */}
      <path
        d="M78 44 C78 26 90 12 108 10 C110 28 98 42 78 44 Z"
        fill="var(--color-brand-leaf)"
        opacity="0.95"
      />
      <path
        d="M52 66 C48 50 56 34 72 28 C77 44 69 60 52 66 Z"
        fill="var(--color-brand-leaf)"
        opacity="0.7"
      />
      <path
        d="M24 86 C16 72 20 55 34 46 C42 60 38 77 24 86 Z"
        fill="var(--color-brand-leaf)"
        opacity="0.85"
      />
    </svg>
  );
}

export default function LeafBackdrop() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* No blurred blobs: the reference has none. Sampling it at the left edge
          and the centre gives the same colour at every depth, so anything
          radial here shows up as a tint the design does not have. */}
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

      {/* Kept clear of the very edges: in the reference the leftmost column of
          the screen is still background at the bottom, with the sprig starting
          a little way in. */}
      <LeafSprig className="absolute left-1 bottom-0 h-24 w-28" />
      <LeafSprig className="absolute right-1 bottom-1 h-28 w-32" flip />
    </div>
  );
}
