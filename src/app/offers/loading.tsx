import { Bone, ProductGridBone, SkeletonShell } from "@/components/layout/Skeleton";

/** Offers while the flash sale, coupons and deal list are read. */
export default function OffersLoading() {
  return (
    <SkeletonShell className="bg-brand-mist">
      <div className="px-4 pt-3">
        <Bone className="h-[104px] w-full rounded-2xl bg-brand-tint tab:h-[132px]" />
      </div>

      {/* Flash sale strip. */}
      <div className="px-4 pt-3">
        <Bone className="h-[15px] w-[120px]" />
        <div className="mt-2 flex gap-2 overflow-hidden">
          {Array.from({ length: 3 }, (_, index) => (
            <Bone key={index} className="h-[168px] w-[124px] shrink-0 rounded-xl bg-white" />
          ))}
        </div>
      </div>

      {/* Coupon row. */}
      <div className="px-4 pt-4">
        <Bone className="h-[15px] w-[96px]" />
        <div className="mt-2 flex gap-2 overflow-hidden">
          {Array.from({ length: 2 }, (_, index) => (
            <Bone key={index} className="h-[74px] w-[196px] shrink-0 rounded-xl bg-white" />
          ))}
        </div>
      </div>

      <div className="px-4 pt-4">
        <div className="flex gap-1.5">
          {Array.from({ length: 4 }, (_, index) => (
            <Bone key={index} className="h-[24px] w-[68px] rounded-full bg-white" />
          ))}
        </div>
        <ProductGridBone count={4} />
      </div>
    </SkeletonShell>
  );
}
