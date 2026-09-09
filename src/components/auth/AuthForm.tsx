"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import {
  Mail,
  Smartphone,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  LoaderCircle,
  CircleAlert,
  ShieldCheck,
} from "lucide-react";
import GoogleIcon from "./GoogleIcon";
import type { AuthActionState } from "@/app/account/actions";

type Method = "email" | "phone";

interface AuthFormProps {
  mode: "signup" | "login";
  action: (state: AuthActionState, formData: FormData) => Promise<AuthActionState>;
  initialError?: string;
}

export default function AuthForm({ mode, action, initialError }: AuthFormProps) {
  const [method, setMethod] = useState<Method>("email");
  const [showPassword, setShowPassword] = useState(false);
  const [state, formAction, pending] = useActionState<AuthActionState, FormData>(
    action,
    initialError ? { error: initialError } : {}
  );

  const isSignup = mode === "signup";

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="method" value={method} />

      <div className="grid grid-cols-2 gap-1 rounded-full bg-brand-tint p-1">
        {(
          [
            { value: "email", label: "Email Address", icon: Mail },
            { value: "phone", label: "Mobile Number", icon: Smartphone },
          ] as const
        ).map(({ value, label, icon: Icon }) => {
          const active = method === value;
          return (
            <button
              key={value}
              type="button"
              onClick={() => setMethod(value)}
              className={`flex items-center justify-center gap-1.5 rounded-full py-2.5 text-xs font-semibold transition-colors ${
                active ? "bg-white text-brand-dark shadow-sm" : "text-brand-dark/50"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          );
        })}
      </div>

      <label className="flex items-center gap-3 rounded-xl border border-neutral-200 bg-white px-4 py-3.5 focus-within:border-brand">
        {method === "email" ? (
          <Mail className="h-4 w-4 shrink-0 text-neutral-400" />
        ) : (
          <Smartphone className="h-4 w-4 shrink-0 text-neutral-400" />
        )}
        <input
          key={method}
          name="identifier"
          type={method === "email" ? "email" : "tel"}
          inputMode={method === "email" ? "email" : "tel"}
          placeholder={method === "email" ? "Enter your email address" : "Enter your mobile number"}
          autoComplete={method === "email" ? "email" : "tel"}
          required
          className="w-full text-sm text-neutral-800 outline-none placeholder:text-neutral-400"
        />
      </label>

      <label className="flex items-center gap-3 rounded-xl border border-neutral-200 bg-white px-4 py-3.5 focus-within:border-brand">
        <Lock className="h-4 w-4 shrink-0 text-neutral-400" />
        <input
          name="password"
          type={showPassword ? "text" : "password"}
          placeholder={isSignup ? "Create a password" : "Enter your password"}
          autoComplete={isSignup ? "new-password" : "current-password"}
          minLength={isSignup ? 8 : undefined}
          required
          className="w-full text-sm text-neutral-800 outline-none placeholder:text-neutral-400"
        />
        <button
          type="button"
          onClick={() => setShowPassword((value) => !value)}
          aria-label={showPassword ? "Hide password" : "Show password"}
          className="shrink-0 text-neutral-400"
        >
          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </label>

      {isSignup && (
        <p className="flex items-center gap-1.5 text-xs text-neutral-400">
          <ShieldCheck className="h-3.5 w-3.5 text-brand" />
          Password must be at least 8 characters
        </p>
      )}

      {state?.error && (
        <div className="flex items-center gap-2 rounded-xl bg-accent-red/10 px-4 py-3 text-xs font-medium text-accent-red">
          <CircleAlert className="h-4 w-4 shrink-0" />
          {state.error}
        </div>
      )}

      <button
        type="submit"
        disabled={pending}
        className="flex items-center justify-center gap-2 rounded-full bg-brand py-3.5 text-sm font-semibold text-white shadow-lg shadow-brand/25 transition-opacity disabled:opacity-70"
      >
        {pending ? (
          <LoaderCircle className="h-4 w-4 animate-spin" />
        ) : (
          <>
            {isSignup ? "Create Account" : "Login"}
            <ArrowRight className="h-4 w-4" />
          </>
        )}
      </button>

      <div className="flex items-center gap-3 text-xs text-neutral-400">
        <span className="h-px flex-1 bg-neutral-200" />
        or
        <span className="h-px flex-1 bg-neutral-200" />
      </div>

      <a
        href="/api/auth/google"
        className="flex items-center justify-center gap-2 rounded-full border border-neutral-200 bg-white py-3.5 text-sm font-semibold text-neutral-700"
      >
        <GoogleIcon className="h-4 w-4" />
        Continue with Google
      </a>

      <p className="mt-2 text-center text-sm text-neutral-500">
        {isSignup ? (
          <>
            Already have an account?{" "}
            <Link href="/account/login" className="font-semibold text-brand">
              Login
            </Link>
          </>
        ) : (
          <>
            New to Zupona?{" "}
            <Link href="/account" className="font-semibold text-brand">
              Create Account
            </Link>
          </>
        )}
      </p>
    </form>
  );
}
