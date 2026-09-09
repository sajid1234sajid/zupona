"use client";

import { useActionState } from "react";
import { LoaderCircle, CircleAlert } from "lucide-react";
import type { AuthUser } from "@/types";
import { updateProfileAction, type ProfileActionState } from "@/app/account/actions";

export default function EditProfileForm({ user }: { user: AuthUser }) {
  const [state, formAction, pending] = useActionState<ProfileActionState, FormData>(updateProfileAction, {});

  return (
    <form action={formAction} className="flex flex-col gap-4 rounded-2xl bg-white p-4 shadow-sm">
      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-semibold text-neutral-500">Full name</span>
        <input
          name="name"
          defaultValue={user.name}
          required
          className="rounded-xl border border-neutral-200 px-4 py-3 text-sm outline-none focus:border-brand"
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-semibold text-neutral-500">Mobile number</span>
        <input
          name="phone"
          type="tel"
          defaultValue={user.phone ?? ""}
          placeholder="+880 1XXXXXXXXX"
          className="rounded-xl border border-neutral-200 px-4 py-3 text-sm outline-none focus:border-brand"
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-semibold text-neutral-500">Email</span>
        <input
          value={user.email ?? "Not set"}
          disabled
          className="rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-400"
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-semibold text-neutral-500">Avatar image URL</span>
        <input
          name="avatarUrl"
          defaultValue={user.avatarUrl ?? ""}
          placeholder="https://example.com/photo.jpg"
          className="rounded-xl border border-neutral-200 px-4 py-3 text-sm outline-none focus:border-brand"
        />
      </label>

      {state.error && (
        <div className="flex items-center gap-2 rounded-xl bg-accent-red/10 px-4 py-3 text-xs font-medium text-accent-red">
          <CircleAlert className="h-4 w-4 shrink-0" />
          {state.error}
        </div>
      )}

      <button
        type="submit"
        disabled={pending}
        className="flex items-center justify-center gap-2 rounded-xl bg-brand py-3.5 text-sm font-semibold text-white disabled:opacity-70"
      >
        {pending && <LoaderCircle className="h-4 w-4 animate-spin" />}
        Save Changes
      </button>
    </form>
  );
}
