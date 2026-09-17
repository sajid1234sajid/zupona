import Image from "@/components/ui/StoreImage";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import BotanicalBackdrop from "./BotanicalBackdrop";
import { listStoreBanners, type StoreBanner } from "@/lib/storefront";
import HeroCarousel from "./HeroCarousel";

/** The top slot of the homepage.
 *
 * A banner published under Marketing > Homepage Banners with the "hero"
 * placement is what a shopper sees here. Publishing one used to change
 * nothing at all on the shop, because this slot was the hardcoded season
 * artwork below and never read the `banners` table; that is the whole reason
 * this component takes a trip to the database.
 *
 * Publish several and they rotate, in the sort order the admin gave them. A
 * single banner is deliberately *not* handed to the carousel: drawn here on
 * the server it is in the HTML the browser first parses, which is what lets
 * the picture start loading before any JavaScript has run.
 *
 * With no banner published -- a fresh shop, or every one of them hidden --
 * the season artwork is still the fallback, so the homepage is never headed
 * by an empty box. */
export default async function HeroBanner() {
  const banners = await listStoreBanners("hero");

  if (banners.length > 1) return <HeroCarousel banners={banners} />;
  return banners[0] ? <PublishedHero banner={banners[0]} /> : <SeasonBanner />;
}

/** The shell both versions sit in: one height on a phone, another on a laptop,
 * so swapping which banner is drawn never moves the page around it. */
const SHELL =
  "relative h-[118px] overflow-hidden rounded-[18px] tab:h-[300px] tab:rounded-3xl";

/** An admin-published banner.
 *
 * An uploaded picture is shown on its own, with nothing written over it. The
 * banners this shop publishes are finished artwork -- headline, price and all,
 * laid out in whatever the admin designed them in -- so a second headline
 * drawn on top only lands across the words already in the picture. The
 * headline typed into the form is still what names the banner in the admin
 * panel, and it becomes the image's alt text here.
 *
 * A banner published without a picture is the other case: there the headline,
 * subtitle and button are all there is to draw, so they are set on the brand
 * green instead. */
function PublishedHero({ banner }: { banner: StoreBanner }) {
  const body = (
    <div className={`${SHELL} bg-[linear-gradient(105deg,#00553d_0%,#007553_100%)]`}>
      {banner.image ? (
        <Image
          src={banner.image}
          alt={banner.title}
          fill
          sizes="(min-width: 700px) 1440px, 100vw"
          preload
          style={{ objectFit: "cover", objectPosition: "50% 50%" }}
        />
      ) : (
        <>
          <BotanicalBackdrop
            className="absolute inset-0 h-full w-full"
            tone="#7fe0c6"
            opacity={0.26}
          />

          <div className="relative z-10 flex h-full max-w-[72%] flex-col justify-center px-3.5 tab:max-w-[58%] tab:px-10 lg:px-14">
            <h1 className="font-serif text-[20px] font-bold leading-[1.1] text-white tab:text-[40px] lg:text-[48px]">
              {banner.title}
            </h1>
            {banner.subtitle ? (
              <p className="mt-1 text-[10px] leading-[1.35] text-white/85 tab:mt-3 tab:text-base">
                {banner.subtitle}
              </p>
            ) : null}
            {banner.href ? (
              <span className="mt-2 inline-flex w-fit items-center gap-1 rounded-full bg-white px-3 py-[5px] text-[9.5px] font-semibold text-brand-dark shadow-[0_2px_6px_rgba(0,40,28,0.35)] tab:mt-5 tab:gap-2 tab:px-6 tab:py-2.5 tab:text-sm">
                Shop Now
                <ArrowRight className="h-3 w-3 tab:h-4 tab:w-4" strokeWidth={2.5} />
              </span>
            ) : null}
          </div>
        </>
      )}
    </div>
  );

  return (
    <section className="px-3.5 pt-2.5 tab:px-0 tab:pt-0">
      {/* Wrapped rather than given a link inside, so the whole banner is the
          target on a phone. A banner with no link is not a dead tap. */}
      {banner.href ? (
        <Link href={banner.href} className="block">
          {body}
        </Link>
      ) : (
        body
      )}
    </section>
  );
}

/** The season banner, shown when nothing is published.
 *
 * The bag is a photograph on a botanical drawing rather than one flat image,
 * so the artwork keeps its proportions on every phone width while the leaves
 * stretch to fill whatever space is left. A radial mask feathers the photo's
 * edges into the green so it reads as composited rather than pasted on.
 *
 * Every `tab:` class is the laptop version of the same banner; below that
 * breakpoint the phone design is untouched. */
function SeasonBanner() {
  return (
    <section className="px-3.5 pt-2.5 tab:px-0 tab:pt-0">
      <div className={`${SHELL} bg-[linear-gradient(105deg,#e3f2ee_0%,#f4fbf9_46%,#d8ece6_100%)]`}>
        <BotanicalBackdrop className="absolute inset-0 h-full w-full" tone="#0a936a" opacity={0.26} />

        {/* `fill` rather than width/height: given explicit dimensions this
            version of next/image sizes from the intrinsic width and height,
            which turned the wide photo into a square crop. A sized wrapper
            plus `fill` frames it instead. The gradient mask feathers the
            photo's left edge into the green so it reads as composited. */}
        <span className="pointer-events-none absolute bottom-0 right-0 block h-[106px] w-[176px] [mask-image:linear-gradient(to_right,transparent_0%,#000_30%)] tab:h-[282px] tab:w-[46%]">
          <Image
            src="https://images.unsplash.com/photo-1594223274512-ad4803739b7c?auto=format&fit=crop&w=1200&q=85"
            alt="Green leather handbag from the new season collection"
            fill
            sizes="(min-width: 700px) 540px, 176px"
            preload
            // Set through `style` rather than a class: this version of
            // next/image writes `object-fit` inline, and an inline
            // declaration beats any class. The source is portrait, so the
            // crop is pulled upward to keep the bag's handle in frame.
            style={{ objectFit: "cover", objectPosition: "50% 32%" }}
          />
        </span>

        <div className="absolute right-2.5 top-2.5 grid h-[44px] w-[44px] place-items-center rounded-full bg-white text-center shadow-[0_2px_8px_rgba(0,60,40,0.16)] tab:right-6 tab:top-6 tab:h-[92px] tab:w-[92px]">
          <span className="leading-none">
            <span className="block text-[10px] font-bold tracking-[0.08em] text-ink-muted tab:text-[12px]">
              UP TO
            </span>
            <span className="block text-[14px] font-extrabold leading-none text-brand tab:text-[30px]">50%</span>
            <span className="block text-[10px] font-bold tracking-[0.08em] text-ink-muted tab:text-[12px]">
              OFF
            </span>
          </span>
        </div>

        <div className="relative z-10 max-w-[57%] px-3.5 pt-2.5 tab:max-w-[54%] tab:px-10 tab:pt-12 lg:px-14">
          <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-brand tab:text-[13px]">
            New Season
          </p>
          <h1 className="mt-1 font-serif text-[20px] font-bold leading-[1.08] text-brand-darkest tab:mt-3 tab:text-[40px] lg:text-[54px]">
            Style Lives Here
          </h1>
          <p className="mt-1 text-[10px] leading-[1.35] text-ink-muted tab:mt-3 tab:text-base">
            Premium picks for
            <br />a better you.
          </p>
          <Link
            href="/offers"
            className="mt-2 inline-flex items-center gap-1 rounded-full bg-brand px-3 py-[5px] text-[9.5px] font-semibold text-white shadow-[0_2px_6px_rgba(0,132,95,0.35)] tab:mt-5 tab:gap-2 tab:px-6 tab:py-2.5 tab:text-sm"
          >
            Shop Now
            <ArrowRight className="h-3 w-3 tab:h-4 tab:w-4" strokeWidth={2.5} />
          </Link>
        </div>
      </div>
    </section>
  );
}
