"use client";

import { useActionState } from "react";
import { LoaderCircle, CircleAlert, CircleCheck } from "lucide-react";
import { changePasswordAction } from "@/app/account/actions";
import type { AuthActionState } from "@/app/account/actions";

export default function ChangePasswordForm({ hasPassword }: { hasPassword: boolean }) {
  const [state, formAction, pending] = useActionState<AuthActionState, FormData>(changePasswordAction, {});

  return (
    <form action={formAction} className="flex flex-col gap-4 rounded-2xl bg-white p-4 shadow-sm">
      {hasPassword && (
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-neutral-500">Current password</span>
          <input
            name="currentPassword"
            type="password"
            autoComplete="current-password"
            required
            className="rounded-xl border border-neutral-200 px-4 py-3 text-sm outline-none focus:border-brand"
          />
        </label>
      )}

      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-semibold text-neutral-500">
          {hasPassword ? "New password" : "Set a password"}
        </span>
        <input
          name="newPassword"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
          className="rounded-xl border border-neutral-200 px-4 py-3 text-sm outline-none focus:border-brand"
        />
      </label>

      {state.error && (
        <div className="flex items-center gap-2 rounded-xl bg-accent-red/10 px-4 py-3 text-xs font-medium text-accent-red">
          <CircleAlert className="h-4 w-4 shrink-0" />
          {state.error}
        </div>
      )}

      {state.success && (
        <div className="flex items-center gap-2 rounded-xl bg-brand-tint px-4 py-3 text-xs font-medium text-brand-dark">
          <CircleCheck className="h-4 w-4 shrink-0" />
          Password updated successfully.
        </div>
      )}

      <button
        type="submit"
        disabled={pending}
        className="flex items-center justify-center gap-2 rounded-xl bg-brand py-3.5 text-sm font-semibold text-white disabled:opacity-70"
      >
        {pending && <LoaderCircle className="h-4 w-4 animate-spin" />}
        {hasPassword ? "Update Password" : "Set Password"}
      </button>
    </form>
  );
}
