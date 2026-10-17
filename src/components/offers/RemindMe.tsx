"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BellRing, Check, LoaderCircle } from "lucide-react";
import { remindMeAction } from "@/app/offers/actions";

export default function RemindMe({ saleId, initiallySet }: { saleId: string; initiallySet: boolean }) {
  const router = useRouter();
  const [set, setSet] = useState(initiallySet);
  const [pending, startTransition] = useTransition();

  if (set) {
    return (
      <span className="inline-flex h-9 items-center gap-1.5 rounded-full bg-white/15 px-3.5 text-[12px] font-bold">
        <Check className="h-4 w-4" /> We&apos;ll remind you
      </span>
    );
  }
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await remindMeAction(saleId);
          if (result.signIn) {
            router.push("/account/login");
            return;
          }
          if (result.ok) setSet(true);
        })
      }
      className="inline-flex h-9 items-center gap-1.5 rounded-full bg-white px-3.5 text-[12px] font-bold text-brand-darkest disabled:opacity-60"
    >
      {pending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <BellRing className="h-4 w-4" />}
      Remind me
    </button>
  );
}
