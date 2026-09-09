"use client";

import { useActionState, useState } from "react";
import { Eye, EyeOff, Loader2, Lock, Mail } from "lucide-react";
import { logInAdminAction, type AdminAuthState } from "@/app/admin/actions";

export default function LoginForm() {
  const [state, formAction, pending] = useActionState<AdminAuthState, FormData>(
    logInAdminAction,
    {}
  );
  const [showPassword, setShowPassword] = useState(false);

  return (
    <form action={formAction} className="space-y-4">
      {state.error ? (
        <p role="alert" className="rounded-xl bg-red-50 px-3.5 py-2.5 text-sm text-red-600">
          {state.error}
        </p>
      ) : null}

      <label className="block">
        <span className="mb-1.5 block text-[13px] font-medium text-neutral-700">
          Email address
        </span>
        <span className="relative block">
          <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
          <input
            type="email"
            name="email"
            required
            autoComplete="username"
            autoFocus
            placeholder="you@zupona.com"
            className="h-12 w-full rounded-xl border border-neutral-200 bg-white pl-10 pr-3.5 text-sm text-neutral-800 outline-none transition placeholder:text-neutral-400 focus:border-brand focus:ring-2 focus:ring-brand/15"
          />
        </span>
      </label>

      <label className="block">
        <span className="mb-1.5 block text-[13px] font-medium text-neutral-700">Password</span>
        <span className="relative block">
          <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
          <input
            type={showPassword ? "text" : "password"}
            name="password"
            required
            autoComplete="current-password"
            placeholder="••••••••"
            className="h-12 w-full rounded-xl border border-neutral-200 bg-white pl-10 pr-11 text-sm text-neutral-800 outline-none transition placeholder:text-neutral-400 focus:border-brand focus:ring-2 focus:ring-brand/15"
          />
          <button
            type="button"
            onClick={() => setShowPassword((value) => !value)}
            aria-label={showPassword ? "Hide password" : "Show password"}
            className="absolute right-1.5 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-600"
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </span>
      </label>

      <button
        type="submit"
        disabled={pending}
        className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-brand text-sm font-semibold text-white shadow-lg shadow-brand/25 transition hover:bg-brand-dark disabled:opacity-70"
      >
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        {pending ? "Signing in…" : "Sign in to dashboard"}
      </button>
    </form>
  );
}
