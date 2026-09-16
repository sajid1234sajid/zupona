import Link from "next/link";
import { Zap, Truck, ArrowRight } from "lucide-react";
import { getShopSettings } from "@/lib/shopSettings";
import { formatPrice } from "@/lib/format";
import BotanicalBackdrop from "./BotanicalBackdrop";

/** The two promotional tiles under the departments.
 *
 * The delivery threshold is read from shop settings rather than typed in, so
 * raising free delivery in the admin panel updates the promise a customer is
 * shown here at the same moment it starts being honoured at checkout.
 *
 * The `tab:` classes are the laptop sizes; the phone design is the rest. */
export default async function PromoBanners() {
  const settings = await getShopSettings();

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
    </section>
  );
}
