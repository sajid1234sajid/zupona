import { Bone, SkeletonShell } from "@/components/layout/Skeleton";

/** All Categories while the department counts are read. */
export default function CategoriesLoading() {
  return (
    <SkeletonShell>
      <div className="border-b border-line-soft px-4 py-2.5">
        <Bone className="h-4 w-[132px]" />
        <Bone className="mt-1.5 h-[10px] w-[168px]" />
      </div>

      {/* The rail on the left, the listing on the right -- the browser's own
          two-pane shape, so neither side shifts when the real one arrives. */}
      <div className="flex gap-2 px-3 pt-3">
        <div className="flex w-[84px] shrink-0 flex-col gap-2">
          {Array.from({ length: 8 }, (_, index) => (
            <Bone key={index} className="h-[58px] w-full rounded-lg" />
          ))}
        </div>
        <div className="grid min-w-0 flex-1 grid-cols-3 gap-2">
          {Array.from({ length: 9 }, (_, index) => (
            <div key={index} className="flex flex-col items-center gap-1.5">
              <Bone className="aspect-square w-full rounded-lg" />
              <Bone className="h-[9px] w-[80%]" />
            </div>
          ))}
        </div>
      </div>
    </SkeletonShell>
  );
}
