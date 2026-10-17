"use client";

import { useActionState } from "react";
import { FormMessage } from "@/components/admin/ui";
import { savePopularSearches, type PopularFormState } from "./actions";

export default function PopularForm({ current }: { current: string[] }) {
  const [state, action, pending] = useActionState<PopularFormState, FormData>(
    savePopularSearches,
    {}
  );
  return (
    <form action={action} className="space-y-3">
      <textarea
        name="popular"
        rows={8}
        defaultValue={current.join("\n")}
        placeholder={"shirt\npanjabi\nwatch\nearbuds"}
        className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm outline-none focus:border-brand"
      />
      <p className="text-xs text-neutral-400">
        One search per line, up to 12. Leave empty to show what shoppers search most in the last 7
        days.
      </p>
      <FormMessage error={state.error} success={state.success} />
      <button
        type="submit"
        disabled={pending}
        className="rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
      >
        {pending ? "Saving…" : "Save popular searches"}
      </button>
    </form>
  );
}
