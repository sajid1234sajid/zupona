/** Decorative leaf-and-blossom artwork for the green promotional surfaces.
 *
 * Drawn rather than photographed so it can be tinted to whatever sits behind
 * it and scaled to any card without a second asset or a network request. The
 * whole thing is presentational, so it is hidden from assistive technology. */
export default function BotanicalBackdrop({
  className = "",
  tone = "#0a936a",
  opacity = 0.22,
  blossoms = true,
}: {
  className?: string;
  /** Leaf colour; the blossoms are always white. */
  tone?: string;
  opacity?: number;
  /** The white blossoms read as stray dots on a small, dark card, so the
   * promotional tiles turn them off and keep only the foliage. */
  blossoms?: boolean;
}) {
  return (
    <svg
      viewBox="0 0 200 120"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      <defs>
        <path id="zupona-leaf" d="M0 0C10-9 26-9 38 0 26 9 10 9 0 0Z" />
        <g id="zupona-blossom">
          <circle cx="0" cy="-4" r="3.1" />
          <circle cx="3.8" cy="-1.2" r="3.1" />
          <circle cx="2.4" cy="3.3" r="3.1" />
          <circle cx="-2.4" cy="3.3" r="3.1" />
          <circle cx="-3.8" cy="-1.2" r="3.1" />
        </g>
      </defs>

      <g fill={tone} opacity={opacity}>
        <use href="#zupona-leaf" transform="translate(150 12) rotate(28) scale(1.5)" />
        <use href="#zupona-leaf" transform="translate(168 34) rotate(-16) scale(1.25)" />
        <use href="#zupona-leaf" transform="translate(126 4) rotate(64) scale(1.1)" />
        <use href="#zupona-leaf" transform="translate(178 74) rotate(52) scale(1.35)" />
        <use href="#zupona-leaf" transform="translate(140 98) rotate(-38) scale(1.2)" />
        <use href="#zupona-leaf" transform="translate(104 108) rotate(14) scale(0.9)" />
        <use href="#zupona-leaf" transform="translate(-6 96) rotate(-24) scale(1.1)" />
        <use href="#zupona-leaf" transform="translate(4 14) rotate(38) scale(0.8)" />
      </g>

      <g fill={tone} opacity={opacity * 0.55}>
        <use href="#zupona-leaf" transform="translate(112 62) rotate(-8) scale(1.6)" />
        <use href="#zupona-leaf" transform="translate(190 52) rotate(96) scale(1.1)" />
      </g>

      {blossoms && (
        <g fill="#ffffff" opacity={Math.min(1, opacity * 3.2)}>
          <use href="#zupona-blossom" transform="translate(158 22) scale(1.05)" />
          <use href="#zupona-blossom" transform="translate(184 60) scale(0.8)" />
        </g>
      )}
    </svg>
  );
}
