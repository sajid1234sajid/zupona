import Link from "next/link";
import { Zap, Truck, ArrowRight } from "lucide-react";
import { getShopSettings } from "@/lib/shopSettings";
import { formatPrice } from "@/lib/format";
import BotanicalBackdrop from "./BotanicalBackdrop";

/** The two promotional tiles under the departments.
 *
 * The delivery threshold is read from shop settings rather than typed in, so
 * raising free delivery in the admin panel updates the promise a customer is
 * shown here at the same moment it starts being honoured at checkout. */
export default async function PromoBanners() {
  const settings = await getShopSettings();

  return (
    <section className="grid grid-cols-2 gap-1.5 px-3.5 pt-2.5">
      <Link
        href="/offers"
        className="relative flex h-[64px] flex-col justify-center overflow-hidden rounded-xl bg-[linear-gradient(135deg,#00553d_0%,#007553_100%)] pl-2.5 pr-[46px] text-white"
      >
        <BotanicalBackdrop
          className="absolute inset-0 h-full w-full"
          tone="#7fe0bd"
          opacity={0.24}
          blossoms={false}
        />

        <span className="relative z-10 flex items-center gap-1">
          <Zap className="h-3 w-3 fill-accent-amber text-accent-amber" />
          <span className="text-[10.5px] font-bold leading-none">Mega Deals</span>
        </span>
        <span className="relative z-10 mt-[3px] text-[7px] leading-none text-white/75">
          Limited Time Only
        </span>
        <span className="relative z-10 mt-1.5 inline-flex w-fit items-center gap-0.5 rounded-full bg-white px-2 py-[3px] text-[7.5px] font-bold text-brand-dark">
          Shop Now
          <ArrowRight className="h-2.5 w-2.5" strokeWidth={3} />
        </span>

        <span className="absolute right-1.5 top-1/2 z-10 grid h-[38px] w-[38px] -translate-y-1/2 place-items-center rounded-full bg-white/95 text-center">
          <span className="leading-none">
            <span className="block text-[5.5px] font-bold tracking-[0.06em] text-ink-muted">
              UP TO
            </span>
            <span className="block text-[12px] font-extrabold leading-none text-brand">50%</span>
            <span className="block text-[5.5px] font-bold tracking-[0.06em] text-ink-muted">
              OFF
            </span>
          </span>
        </span>
      </Link>

      <Link
        href="/offers"
        className="relative flex h-[64px] flex-col justify-center overflow-hidden rounded-xl border border-brand-tint bg-[linear-gradient(135deg,#eef8f2_0%,#ffffff_60%,#e4f3ea_100%)] pl-2.5 pr-[40px]"
      >
        <BotanicalBackdrop
          className="absolute inset-0 h-full w-full"
          tone="#0a936a"
          opacity={0.16}
          blossoms={false}
        />

        <span className="relative z-10 flex items-center gap-1">
          <Truck className="h-3 w-3 text-brand" strokeWidth={2.4} />
          <span className="text-[10.5px] font-bold leading-none text-brand-darkest">
            Free Delivery
          </span>
        </span>
        <span className="relative z-10 mt-[3px] text-[7px] leading-[1.3] text-ink-muted">
          On orders over
          <br />
          {formatPrice(settings.freeShippingThreshold)}
        </span>
        <span className="relative z-10 mt-1.5 inline-flex w-fit items-center gap-0.5 rounded-full bg-brand px-2 py-[3px] text-[7.5px] font-bold text-white">
          Shop Now
          <ArrowRight className="h-2.5 w-2.5" strokeWidth={3} />
        </span>

        <Truck
          aria-hidden
          className="absolute bottom-1.5 right-1.5 h-[32px] w-[32px] text-brand/30"
          strokeWidth={1.3}
        />
      </Link>
    </section>
  );
}
