import Image from "@/components/ui/StoreImage";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { listStoreBanners, type StoreBanner } from "@/lib/storefront";
import BotanicalBackdrop from "./BotanicalBackdrop";

/** The promotional banners under the departments.
 *
 * Mega Deals and free delivery used to be drawn here in CSS -- a gradient, a
 * lucide icon and a line of type each, side by side. They are now the shop's
 * own artwork, which arrives already carrying its headline, its badges and
 * its illustration, so the pair is drawn full width instead: at roughly four
 * to one, half a phone's width would have cropped away most of each picture.
 *
 * Each still carries the Shop Now pill it had, set into the corner over the
 * artwork rather than beside it, so the tile is as tappable-looking as it was
 * and no wording is drawn across the wording already in the picture.
 *
 * Banners published under the "promo" placement join them below, in the same
 * single column, which is what makes that choice in the admin panel mean
 * something on the shop.
 *
 * The `tab:` classes are the laptop sizes; the phone design is the rest. */
export default async function PromoBanners() {
  const promos = await listStoreBanners("promo");

  return (
    <section className="flex flex-col gap-1.5 px-3.5 pt-2.5 tab:gap-3 tab:px-0 tab:pt-3">
      <ArtworkBanner
        src="/promo-mega-deals.webp"
        alt="Mega Deals -- top picks, best value, limited stock, up to 50% off"
        width={1075}
        height={249}
        pill="bg-white text-brand-dark"
      />

      <ArtworkBanner
        src="/promo-free-delivery.webp"
        alt="Free delivery on orders over ৳1,000"
        width={1563}
        height={275}
        pill="bg-brand text-white"
      />

      {promos.map((promo) => (
        <PromoTile key={promo.id} banner={promo} />
      ))}
    </section>
  );
}

/** One of the shop's two standing banners.
 *
 * The frame is given the picture's own ratio rather than a fixed height, so
 * the artwork is shown whole at every width and nothing of it is cropped --
 * these are single images with their text baked in, and a crop would cut a
 * word in half. `sizes` is what keeps a phone off the full-width file. */
function ArtworkBanner({
  src,
  alt,
  width,
  height,
  pill,
}: {
  src: string;
  alt: string;
  width: number;
  height: number;
  /** Colours for the Shop Now pill, picked to sit on that artwork. */
  pill: string;
}) {
  return (
    <Link
      href="/offers"
      className="relative block w-full overflow-hidden rounded-xl tab:rounded-2xl"
      style={{ aspectRatio: `${width} / ${height}` }}
    >
      <Image
        src={src}
        alt={alt}
        fill
        sizes="(min-width: 700px) 1392px, 100vw"
        style={{ objectFit: "cover", objectPosition: "50% 50%" }}
      />

      <span
        className={`absolute bottom-1 right-1 z-10 inline-flex items-center gap-0.5 rounded-full px-1.5 py-[2px] text-[9px] font-bold shadow-[0_1px_5px_rgba(0,40,28,0.28)] tab:bottom-5 tab:right-6 tab:gap-1.5 tab:px-4 tab:py-1.5 tab:text-[13px] ${pill}`}
      >
        Shop Now
        <ArrowRight className="h-2.5 w-2.5 tab:h-3.5 tab:w-3.5" strokeWidth={3} />
      </span>
    </Link>
  );
}

/** One admin-published promo banner, drawn in the same single column as the
 * pair above it.
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
      sizes="(min-width: 700px) 1392px, 100vw"
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
    "relative flex h-[92px] flex-col justify-center overflow-hidden rounded-xl bg-[linear-gradient(135deg,#00553d_0%,#007553_100%)] px-3 tab:h-[150px] tab:rounded-2xl tab:px-8";

  return banner.href ? (
    <Link href={banner.href} className={shell}>
      {body}
    </Link>
  ) : (
    <div className={shell}>{body}</div>
  );
}
