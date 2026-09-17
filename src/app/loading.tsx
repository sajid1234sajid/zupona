import { Bone, ProductGridBone, SkeletonShell } from "@/components/layout/Skeleton";

/** The home page while its catalog is being read. */
export default function HomeLoading() {
  return (
    <SkeletonShell>
      {/* Hero, at the banner's own height so the grid below does not jump. */}
      <div className="px-3.5 pt-2.5 tab:px-0">
        <Bone className="h-[118px] w-full rounded-[18px] tab:h-[300px] tab:rounded-3xl" />
      </div>

      {/* Department tiles, two to a row. */}
      <div className="mt-2.5 grid grid-cols-2 gap-2 px-3.5 tab:px-0">
        {Array.from({ length: 6 }, (_, index) => (
          <div key={index} className="flex items-center gap-2.5 rounded-xl border border-line bg-white p-2.5">
            <Bone className="h-[34px] w-[34px] shrink-0 rounded-lg" />
            <span className="flex min-w-0 flex-1 flex-col gap-1">
              <Bone className="h-[11px] w-[76%]" />
              <Bone className="h-[9px] w-[54%]" />
            </span>
          </div>
        ))}
      </div>

      {/* The two promo cards. */}
      <div className="mt-2.5 grid grid-cols-2 gap-2 px-3.5 tab:px-0">
        <Bone className="h-[92px] rounded-xl" />
        <Bone className="h-[92px] rounded-xl" />
      </div>

      <div className="px-3.5 pt-3 tab:px-0">
        <Bone className="h-[13px] w-[128px]" />
        <div className="mt-2 flex gap-1.5">
          {Array.from({ length: 5 }, (_, index) => (
            <Bone key={index} className="h-[22px] w-[62px] rounded-full" />
          ))}
        </div>
        <ProductGridBone count={6} />
      </div>
    </SkeletonShell>
  );
}
