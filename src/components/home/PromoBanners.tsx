import Image from "@/components/ui/StoreImage";
import Link from "next/link";
import { Zap, Truck, ArrowRight } from "lucide-react";
import { getShopSettings } from "@/lib/shopSettings";
import { formatPrice } from "@/lib/format";
import { listStoreBanners, type StoreBanner } from "@/lib/storefront";
import BotanicalBackdrop from "./BotanicalBackdrop";

/** The promotional tiles under the departments.
 *
 * The delivery threshold is read from shop settings rather than typed in, so
 * raising free delivery in the admin panel updates the promise a customer is
 * shown here at the same moment it starts being honoured at checkout.
 *
 * Banners published under the "promo" placement join the two standing tiles
 * as further tiles in the same grid, which is what makes that choice in the
 * admin panel mean something on the shop.
 *
 * The `tab:` classes are the laptop sizes; the phone design is the rest. */
export default async function PromoBanners() {
  const [settings, promos] = await Promise.all([getShopSettings(), listStoreBanners("promo")]);

  return (
    <section className="grid grid-cols-2 gap-1.5 px-3.5 pt-2.5 tab:gap-3 tab:px-0 tab:pt-3">
      <Link
        href="/offers"
        className="relative flex h-[92px] flex-col justify-center overflow-hidden rounded-xl bg-[linear-gradient(135deg,#00553d_0%,#007553_100%)] pl-3 pr-[58px] text-white tab:h-[150px] tab:rounded-2xl tab:pl-8 tab:pr-[140px]"
      >
        <BotanicalBackdrop
          className="absolute inset-0 h-full w-full"
          tone="#7fe0c6"
          opacity={0.24}
          blossoms={false}
        />

        <span className="relative z-10 flex items-center gap-1 tab:gap-2">
          <Zap className="h-3 w-3 fill-accent-amber text-accent-amber tab:h-5 tab:w-5" />
          <span className="text-[10.5px] font-bold leading-none tab:text-xl">Mega Deals</span>
        </span>
        <span className="relative z-10 mt-[3px] text-[10px] leading-none text-brand-tint tab:mt-2 tab:text-sm">
          Limited Time Only
        </span>
        <span className="relative z-10 mt-1.5 inline-flex w-fit items-center gap-0.5 rounded-full bg-white px-2 py-[3px] text-[10px] font-bold text-brand-dark tab:mt-4 tab:gap-1.5 tab:px-4 tab:py-1.5 tab:text-[13px]">
          Shop Now
          <ArrowRight className="h-2.5 w-2.5 tab:h-3.5 tab:w-3.5" strokeWidth={3} />
        </span>

        <span className="absolute right-2 top-1/2 z-10 grid h-[50px] w-[50px] -translate-y-1/2 place-items-center rounded-full bg-white text-center tab:right-8 tab:h-[92px] tab:w-[92px]">
          <span className="leading-none">
            <span className="block text-[10px] font-bold tracking-[0.06em] text-ink-muted tab:text-[12px]">
              UP TO
            </span>
            <span className="block text-[14px] font-extrabold leading-none text-brand tab:text-[28px]">50%</span>
            <span className="block text-[10px] font-bold tracking-[0.06em] text-ink-muted tab:text-[12px]">
              OFF
            </span>
          </span>
        </span>
      </Link>

      <Link
        href="/offers"
        className="relative flex h-[92px] flex-col justify-center overflow-hidden rounded-xl border border-brand-tint bg-[linear-gradient(135deg,#eaf7f3_0%,#ffffff_60%,#dff2ec_100%)] pl-3 pr-[46px] tab:h-[150px] tab:rounded-2xl tab:pl-8 tab:pr-[120px]"
      >
        <BotanicalBackdrop
          className="absolute inset-0 h-full w-full"
          tone="#0a936a"
          opacity={0.16}
          blossoms={false}
        />

        <span className="relative z-10 flex items-center gap-1 tab:gap-2">
          <Truck className="h-3 w-3 text-brand tab:h-5 tab:w-5" strokeWidth={2.4} />
          <span className="text-[10.5px] font-bold leading-none text-brand-darkest tab:text-xl">
            Free Delivery
          </span>
        </span>
        <span className="relative z-10 mt-[3px] text-[10px] leading-[1.3] text-ink-muted tab:mt-2 tab:text-sm">
          On orders over
          <br />
          {formatPrice(settings.freeShippingThreshold)}
        </span>
        <span className="relative z-10 mt-1.5 inline-flex w-fit items-center gap-0.5 rounded-full bg-brand px-2 py-[3px] text-[10px] font-bold text-white tab:mt-4 tab:gap-1.5 tab:px-4 tab:py-1.5 tab:text-[13px]">
          Shop Now
          <ArrowRight className="h-2.5 w-2.5 tab:h-3.5 tab:w-3.5" strokeWidth={3} />
        </span>

        <Truck
          aria-hidden
          className="absolute bottom-1.5 right-1.5 h-[30px] w-[30px] text-brand-tint tab:bottom-5 tab:right-8 tab:h-[72px] tab:w-[72px]"
          strokeWidth={1.3}
        />
      </Link>

      {promos.map((promo) => (
        <PromoTile key={promo.id} banner={promo} />
      ))}
    </section>
  );
}

/** One admin-published promo tile, built to the same height as the pair above
 * it so an odd number of them still leaves a tidy grid.
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
      sizes="(min-width: 700px) 720px, 50vw"
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
