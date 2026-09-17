import Image from "@/components/ui/StoreImage";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { listStoreBanners, type StoreBanner } from "@/lib/storefront";
import BotanicalBackdrop from "./BotanicalBackdrop";

/** The two promotional banners, in the shop's own artwork.
 *
 * They are drawn from two shapes of the same picture, because the two places
 * they sit are nothing like each other. On a phone the pair shares a row, half
 * a screen each, so each one gets the tile cut of its artwork -- the headline
 * over the illustration, in a frame three units wide to four tall. On a laptop
 * they stand in a column beside the hero, where the wide cut belongs.
 *
 * `<picture>` rather than two images with one hidden: the browser downloads
 * only the source whose media query it matches, so a phone never pays for the
 * wide file and a laptop never pays for the tile.
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
        tile="/promo-mega-deals-tile.webp"
        wide="/promo-mega-deals.webp"
        alt="Mega Deals -- top picks, best value and limited stock, up to 50% off"
        shape="aspect-[4/3] tab:aspect-[1075/249]"
        pill="bg-white text-brand-dark"
      />

      <ArtworkBanner
        tile="/promo-free-delivery-tile.webp"
        wide="/promo-free-delivery.webp"
        alt="Free delivery on orders over ৳1,000"
        shape="aspect-[4/3] tab:aspect-[1563/275]"
        pill="bg-brand text-white"
        // This artwork's own background is very nearly white, so without an
        // edge the tile dissolves into the page it sits on.
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
 * The frame takes the ratio of whichever cut is showing rather than a fixed
 * height, so the artwork is drawn whole at every width: these are single
 * pictures with their wording baked in, and a crop would cut a word in half.
 *
 * The Shop Now pill sits bottom left, which is the corner both tiles were
 * composed to leave empty, and moves to the right on the wide cut where that
 * is the quiet corner instead. */
function ArtworkBanner({
  tile,
  wide,
  alt,
  shape,
  pill,
  frame = "",
}: {
  /** Three-to-four cut, drawn on a phone. */
  tile: string;
  /** Wide cut, drawn from the `tab` breakpoint up. */
  wide: string;
  alt: string;
  shape: string;
  /** Colours for the Shop Now pill, picked to sit on that artwork. */
  pill: string;
  /** An edge, for artwork too pale to show one of its own. */
  frame?: string;
}) {
  return (
    <Link
      href="/offers"
      className={`relative block w-full overflow-hidden rounded-xl tab:rounded-2xl ${shape} ${frame}`}
    >
      <picture>
        <source media="(min-width: 700px)" srcSet={wide} />
        {/* Plain <img>: these are two fixed files, each already cut and sized
            for the one place it is drawn, so there is nothing for the image
            optimiser to do and `<picture>` is what picks between them. */}
        <img
          src={tile}
          alt={alt}
          loading="lazy"
          decoding="async"
          className="absolute inset-0 h-full w-full object-cover"
        />
      </picture>

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
    "relative flex aspect-[4/3] flex-col justify-center overflow-hidden rounded-xl bg-[linear-gradient(135deg,#00553d_0%,#007553_100%)] px-3 tab:aspect-[1075/249] tab:rounded-2xl tab:px-8";

  return banner.href ? (
    <Link href={banner.href} className={shell}>
      {body}
    </Link>
  ) : (
    <div className={shell}>{body}</div>
  );
}
