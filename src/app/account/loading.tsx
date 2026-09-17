import { Bone, SkeletonShell } from "@/components/layout/Skeleton";

/** The account tab while it works out whether anyone is signed in.
 *
 * It stands in for both answers, because the page renders the profile for a
 * shopper and the sign-up screen for everyone else, and which one it will be
 * is exactly what is still being read. So this shows the shape they share --
 * a card at the top, rows beneath it -- rather than committing to either. */
export default function AccountLoading() {
  return (
    <SkeletonShell className="bg-brand-mist">
      <div className="px-4 pt-4">
        <div className="flex items-center gap-3 rounded-2xl bg-white p-4">
          <Bone className="h-14 w-14 shrink-0 rounded-full" />
          <span className="flex min-w-0 flex-1 flex-col gap-1.5">
            <Bone className="h-[13px] w-[54%]" />
            <Bone className="h-[10px] w-[38%]" />
          </span>
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2">
          {Array.from({ length: 3 }, (_, index) => (
            <Bone key={index} className="h-[60px] rounded-xl bg-white" />
          ))}
        </div>

        <div className="mt-3 flex flex-col gap-1.5">
          {Array.from({ length: 6 }, (_, index) => (
            <div key={index} className="flex items-center gap-3 rounded-xl bg-white px-3 py-3">
              <Bone className="h-5 w-5 shrink-0 rounded" />
              <Bone className="h-[11px] w-[46%]" />
            </div>
          ))}
        </div>
      </div>
    </SkeletonShell>
  );
}
