import Image from "@/components/ui/StoreImage";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { listStoreBanners, type StoreBanner } from "@/lib/storefront";
import BotanicalBackdrop from "./BotanicalBackdrop";

/** The two promotional banners, in the shop's own artwork.
 *
 * The owner draws these, and supplies each one twice: a card-shaped pair for
 * the phone row and a wide pair for the laptop column. Neither is cropped,
 * stretched or drawn over here -- each is shown whole in a card of its own
 * ratio. The card files are their sheet of the two cards cut in half and
 * given the phone card's exact ratio, which the artwork was short of only in
 * height, made up by stretching each card's own top and bottom edge rows: no
 * part of the design touches an edge, so what is added is background.
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
        card="/promo-mega-deals-card.webp"
        wide="/promo-mega-deals.webp"
        alt="Mega Deals -- top picks, special deals"
        shape="aspect-[327/191] tab:aspect-[1075/249]"
        // Sampled from the artwork's own edge, so the card is the picture's
        // colour for the moment before the picture itself arrives.
        surface="bg-[#0b7d3f]"
        pill="bg-white text-brand-dark"
      />

      <ArtworkBanner
        card="/promo-free-delivery-card.webp"
        wide="/promo-free-delivery.webp"
        alt="Free delivery on orders over ৳1,000"
        shape="aspect-[327/191] tab:aspect-[1563/275]"
        surface="bg-[#e6f8ec]"
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
 * the margins and gap this row already had. That size is settled; what
 * changes here is only which of the owner's two files is drawn in it. */
function ArtworkBanner({
  card,
  wide,
  alt,
  shape,
  surface,
  pill,
  frame = "",
}: {
  /** The card-shaped artwork, drawn on a phone. */
  card: string;
  /** The wide artwork, drawn from the `tab` breakpoint up. */
  wide: string;
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
      <picture>
        <source media="(min-width: 700px)" srcSet={wide} />
        {/* Each file is already the ratio of the card it is drawn in, so
            `cover` cannot crop anything; `<picture>` is what gives a phone
            the card-shaped artwork and a laptop the wide one, and it fetches
            only the one it will draw. */}
        <img
          src={card}
          alt={alt}
          loading="lazy"
          decoding="async"
          className="absolute inset-0 h-full w-full object-cover"
        />
      </picture>

      {/* The phone artwork carries its own call to action, so the pill is the
          laptop's alone -- the wide cut has none drawn into it. */}
      <span
        className={`absolute bottom-2 right-2 z-10 hidden items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold shadow-[0_1px_5px_rgba(0,40,28,0.28)] tab:inline-flex ${pill}`}
      >
        Shop Now
        <ArrowRight className="h-3.5 w-3.5" strokeWidth={3} />
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
