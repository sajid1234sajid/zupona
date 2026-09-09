import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import BotanicalBackdrop from "./BotanicalBackdrop";

/** The season banner.
 *
 * The bag is a photograph on a botanical drawing rather than one flat image,
 * so the artwork keeps its proportions on every phone width while the leaves
 * stretch to fill whatever space is left. A radial mask feathers the photo's
 * edges into the green so it reads as composited rather than pasted on. */
export default function HeroBanner() {
  return (
    <section className="px-3.5 pt-2.5">
      <div className="relative h-[118px] overflow-hidden rounded-[18px] bg-[linear-gradient(105deg,#e6f4ec_0%,#f5fbf7_46%,#dcefe4_100%)]">
        <BotanicalBackdrop className="absolute inset-0 h-full w-full" tone="#0a936a" opacity={0.26} />

        {/* `fill` rather than width/height: given explicit dimensions this
            version of next/image sizes from the intrinsic width and height,
            which turned the wide photo into a square crop. A sized wrapper
            plus `fill` frames it instead. The gradient mask feathers the
            photo's left edge into the green so it reads as composited. */}
        <span className="pointer-events-none absolute bottom-0 right-0 block h-[106px] w-[176px] [mask-image:linear-gradient(to_right,transparent_0%,#000_30%)]">
          <Image
            src="https://images.unsplash.com/photo-1594223274512-ad4803739b7c?auto=format&fit=crop&w=480&q=75"
            alt="Green leather handbag from the new season collection"
            fill
            sizes="176px"
            preload
            // Set through `style` rather than a class: this version of
            // next/image writes `object-fit` inline, and an inline
            // declaration beats any class. The source is portrait, so the
            // crop is pulled upward to keep the bag's handle in frame.
            style={{ objectFit: "cover", objectPosition: "50% 32%" }}
          />
        </span>

        <div className="absolute right-2.5 top-2.5 grid h-[44px] w-[44px] place-items-center rounded-full bg-white text-center shadow-[0_2px_8px_rgba(0,60,40,0.16)]">
          <span className="leading-none">
            <span className="block text-[6.5px] font-bold tracking-[0.08em] text-ink-muted">
              UP TO
            </span>
            <span className="block text-[14px] font-extrabold leading-none text-brand">50%</span>
            <span className="block text-[6.5px] font-bold tracking-[0.08em] text-ink-muted">
              OFF
            </span>
          </span>
        </div>

        <div className="relative z-10 max-w-[57%] px-3.5 pt-2.5">
          <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-brand">
            New Season
          </p>
          <h1 className="mt-1 font-serif text-[20px] font-bold leading-[1.08] text-brand-darkest">
            Style Lives Here
          </h1>
          <p className="mt-1 text-[8.5px] leading-[1.35] text-ink-muted">
            Premium picks for
            <br />a better you.
          </p>
          <Link
            href="/offers"
            className="mt-2 inline-flex items-center gap-1 rounded-full bg-brand px-3 py-[5px] text-[9.5px] font-semibold text-white shadow-[0_2px_6px_rgba(0,132,95,0.35)]"
          >
            Shop Now
            <ArrowRight className="h-3 w-3" strokeWidth={2.5} />
          </Link>
        </div>
      </div>
    </section>
  );
}
