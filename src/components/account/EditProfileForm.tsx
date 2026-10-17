"use client";

import { useActionState } from "react";
import { LoaderCircle, CircleAlert } from "lucide-react";
import type { AuthUser } from "@/types";
import { updateProfileAction, type ProfileActionState } from "@/app/account/actions";
import AvatarUploader from "./AvatarUploader";

export default function EditProfileForm({ user }: { user: AuthUser }) {
  const [state, formAction, pending] = useActionState<ProfileActionState, FormData>(updateProfileAction, {});

  return (
    <form action={formAction} className="flex flex-col gap-4 rounded-2xl bg-white p-4 shadow-card">
      <AvatarUploader
        avatarUrl={user.avatarUrl ?? null}
        name={user.name}
        initials={user.name.trim().split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase() || "Z"}
      />

      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-semibold text-ink-slate">Full name</span>
        <input
          name="name"
          defaultValue={user.name}
          required
          className="rounded-xl border border-line px-4 py-3 text-sm outline-none focus:border-brand"
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-semibold text-ink-slate">Mobile number</span>
        <input
          name="phone"
          type="tel"
          defaultValue={user.phone ?? ""}
          placeholder="+880 1XXXXXXXXX"
          className="rounded-xl border border-line px-4 py-3 text-sm outline-none focus:border-brand"
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-semibold text-ink-slate">Email</span>
        <input
          value={user.email ?? "Not set"}
          disabled
          className="rounded-xl border border-line bg-brand-mist px-4 py-3 text-sm text-ink-slate"
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
