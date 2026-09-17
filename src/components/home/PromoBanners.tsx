import Image from "@/components/ui/StoreImage";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { listStoreBanners, type StoreBanner } from "@/lib/storefront";
import BotanicalBackdrop from "./BotanicalBackdrop";

/** The two promotional banners, in the shop's own artwork.
 *
 * The artwork is the shop's, finished and untouched: one file each, shown
 * whole, never cropped, re-cut or drawn over. The card is what changes shape
 * around it. On a phone the pair shares a row half a screen each, in the
 * compact card the shop owner measured out -- and because that card is far
 * squarer than a banner better than four to one, the picture is fitted inside
 * it rather than filling it, with the card carrying the artwork's own colour
 * so the fit reads as the picture's background rather than as a gap. On a
 * laptop the pair stands in a column beside the hero, where each card takes
 * its picture's exact ratio and the artwork fills it edge to edge.
 *
 * Banners published under the "promo" placement join them, taking the same
 * shape, which is what makes that choice in the admin panel mean something on
 * the shop.
 *
 * The `tab:` classes are the laptop sizes; the phone design is the rest. */
export default async function PromoBanners() {
  const promos = await listStoreBanners("promo");

  return (
    <section className="grid grid-cols-2 gap-1.5 px-3.5 pt-2.5 tab:flex tab:h-full tab:flex-col tab:justify-between tab:gap-3 tab:px-0 tab:pt-0">
      <ArtworkBanner
        src="/promo-mega-deals.webp"
        alt="Mega Deals -- top picks, best value and limited stock, up to 50% off"
        shape="aspect-[327/191] tab:aspect-[1075/249]"
        // Sampled from the artwork's own edge, so the card reads as the
        // picture's background continuing rather than as a box around it.
        surface="bg-[#076827]"
        pill="bg-white text-brand-dark"
      />

      <ArtworkBanner
        src="/promo-free-delivery.webp"
        alt="Free delivery on orders over ৳1,000"
        shape="aspect-[327/191] tab:aspect-[1563/275]"
        surface="bg-[#ecf4ef]"
        pill="bg-brand text-white"
        // This artwork's own background is very nearly white, so without an
        // edge the card dissolves into the page it sits on.
        frame="border border-brand-tint"
      />

      {promos.map((promo) => (
        <PromoTile key={promo.id} banner={promo} />
      ))}
    </section>
  );
}

/** One of the shop's two standing banners.
 *
 * The phone card's ratio is measured off the shop owner's own screen -- 327
 * by 191 of their 719px-wide screenshot, which is 163 by 95 css pixels beside
 * the margins and gap this row already had.
 *
 * The Shop Now pill sits bottom left on a phone, inside the band the fitted
 * picture leaves rather than on top of the artwork, and moves to the bottom
 * right on a laptop where the picture fills the card. */
function ArtworkBanner({
  src,
  alt,
  shape,
  surface,
  pill,
  frame = "",
}: {
  src: string;
  alt: string;
  shape: string;
  /** The card's own colour, taken from the artwork's edge. */
  surface: string;
  /** Colours for the Shop Now pill, picked to sit on that artwork. */
  pill: string;
  /** An edge, for artwork too pale to show one of its own. */
  frame?: string;
}) {
  return (
    <Link
      href="/offers"
      className={`relative block w-full overflow-hidden rounded-xl tab:rounded-2xl ${shape} ${surface} ${frame}`}
    >
      <Image
        src={src}
        alt={alt}
        fill
        sizes="(min-width: 700px) 620px, 50vw"
        // `contain`, never `cover`: the card on a phone is far squarer than
        // the picture, and these banners carry their own wording, so a crop
        // would take a word with it. The whole picture is drawn at the
        // largest size that fits and the card's colour fills the rest.
        style={{ objectFit: "contain", objectPosition: "50% 50%" }}
      />

      <span
        className={`absolute bottom-1 left-1 z-10 inline-flex items-center gap-0.5 rounded-full px-1.5 py-[2px] text-[9px] font-bold shadow-[0_1px_5px_rgba(0,40,28,0.28)] tab:bottom-2 tab:left-auto tab:right-2 tab:gap-1 tab:px-2.5 tab:py-1 tab:text-[11px] ${pill}`}
      >
        Shop Now
        <ArrowRight className="h-2.5 w-2.5 tab:h-3.5 tab:w-3.5" strokeWidth={3} />
      </span>
    </Link>
  );
}

/** One admin-published promo banner, taking the same shape as the pair above
 * it so a published tile sits in the row rather than beside it.
 *
 * As in the hero, an uploaded picture is left to speak for itself: these
 * banners arrive as finished artwork with their own wording, and a headline
 * drawn on top would sit across it. Only a tile published without a picture
 * is given the copy to show. */
function PromoTile({ banner }: { banner: StoreBanner }) {
  const body = banner.image ? (
    <Image
      src={banner.image}
      alt={banner.title}
      fill
      sizes="(min-width: 700px) 600px, 50vw"
      style={{ objectFit: "cover", objectPosition: "50% 50%" }}
    />
  ) : (
    <>
      <BotanicalBackdrop
        className="absolute inset-0 h-full w-full"
        tone="#7fe0c6"
        opacity={0.24}
        blossoms={false}
      />

      <span className="relative z-10 block text-[10.5px] font-bold leading-tight text-white tab:text-xl">
        {banner.title}
      </span>
      {banner.subtitle ? (
        <span className="relative z-10 mt-[3px] block text-[10px] leading-[1.3] text-brand-tint tab:mt-2 tab:text-sm">
          {banner.subtitle}
        </span>
      ) : null}
      {banner.href ? (
        <span className="relative z-10 mt-1.5 inline-flex w-fit items-center gap-0.5 rounded-full bg-white px-2 py-[3px] text-[10px] font-bold text-brand-dark tab:mt-4 tab:gap-1.5 tab:px-4 tab:py-1.5 tab:text-[13px]">
          Shop Now
          <ArrowRight className="h-2.5 w-2.5 tab:h-3.5 tab:w-3.5" strokeWidth={3} />
        </span>
      ) : null}
    </>
  );

  const shell =
    "relative flex aspect-[327/191] flex-col justify-center overflow-hidden rounded-xl bg-[linear-gradient(135deg,#00553d_0%,#007553_100%)] px-3 tab:aspect-[1075/249] tab:rounded-2xl tab:px-8";

  return banner.href ? (
    <Link href={banner.href} className={shell}>
      {body}
    </Link>
  ) : (
    <div className={shell}>{body}</div>
  );
}
