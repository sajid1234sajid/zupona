/** The Bangladesh flag, drawn rather than typed.
 *
 * This was an emoji, which renders as a different picture on every platform
 * and disappears entirely on some builds. The official proportions are 10:6
 * with the disc centred slightly left of middle. */
export default function BangladeshFlag({ className = "" }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 50 30" className={className} xmlns="http://www.w3.org/2000/svg">
      <rect width="50" height="30" rx="3" fill="#006A4E" />
      <circle cx="22.5" cy="15" r="9" fill="#F42A41" />
    </svg>
  );
}
