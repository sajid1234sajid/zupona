import { Bone, SkeletonShell } from "@/components/layout/Skeleton";

/** The cart while its lines and the delivery charge are read. */
export default function CartLoading() {
  return (
    <SkeletonShell className="bg-brand-mist">
      <div className="px-4 pt-4">
        <Bone className="h-[18px] w-[92px]" />

        <div className="mt-3 flex flex-col gap-2">
          {Array.from({ length: 3 }, (_, index) => (
            <div key={index} className="flex gap-3 rounded-xl border border-line bg-white p-2.5">
              <Bone className="h-20 w-20 shrink-0 rounded-lg" />
              <span className="flex min-w-0 flex-1 flex-col gap-1.5">
                <Bone className="h-[11px] w-[84%]" />
                <Bone className="h-[11px] w-[56%]" />
                <Bone className="mt-1 h-[14px] w-[40%]" />
              </span>
            </div>
          ))}
        </div>

        {/* The totals card the checkout button sits under. */}
        <div className="mt-3 rounded-xl border border-line bg-white p-3">
          <Bone className="h-[11px] w-full" />
          <Bone className="mt-2 h-[11px] w-[72%]" />
          <Bone className="mt-3 h-[38px] w-full rounded-full" />
        </div>
      </div>
    </SkeletonShell>
  );
}
