import { Leaf } from "lucide-react";

/** The soft leaf/blur decoration behind every checkout screen. */
export default function LeafBackdrop() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <span className="absolute -top-20 -right-20 h-56 w-56 rounded-full bg-brand-light/15 blur-3xl" />
      <span className="absolute top-1/3 -left-24 h-56 w-56 rounded-full bg-brand/10 blur-3xl" />
      <span className="absolute -bottom-24 -right-16 h-64 w-64 rounded-full bg-brand-light/15 blur-3xl" />

      <Leaf className="absolute left-2 top-40 h-10 w-10 -rotate-12 text-brand/10" />
      <Leaf className="absolute right-3 top-72 h-8 w-8 rotate-45 text-brand/10" />
      <Leaf className="absolute -left-1 bottom-40 h-14 w-14 rotate-12 text-brand/10" />
      <Leaf className="absolute right-4 bottom-16 h-12 w-12 -rotate-45 text-brand/10" />
      <Leaf className="absolute left-10 bottom-4 h-9 w-9 rotate-90 text-brand/10" />
    </div>
  );
}
