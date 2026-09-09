import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Leaf, ShieldCheck } from "lucide-react";
import { getCurrentUser } from "@/lib/session";
import LoginForm from "@/components/admin/LoginForm";

export const metadata: Metadata = {
  title: "Sign in",
  // The back office should never appear in a search result.
  robots: { index: false, follow: false },
};

export default async function AdminLoginPage() {
  // Anyone already carrying a staff session skips the form -- this is the
  // "type the address, land on the dashboard" path once you are signed in.
  const user = await getCurrentUser();
  if (user && (user.role === "admin" || user.role === "support")) {
    redirect("/admin");
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-[#0e3220] via-[#10402a] to-[#071c12] px-4 py-10">
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <span className="absolute -top-24 -left-16 h-72 w-72 rounded-full bg-brand-light/20 blur-3xl" />
        <span className="absolute -bottom-28 -right-20 h-80 w-80 rounded-full bg-brand/20 blur-3xl" />
        <Leaf className="absolute left-8 bottom-10 h-40 w-40 rotate-12 text-white/[0.04]" />
        <Leaf className="absolute right-10 top-12 h-28 w-28 -rotate-45 text-white/[0.04]" />
      </div>

      <div className="relative w-full max-w-[400px]">
        <div className="mb-6 flex flex-col items-center text-center">
          <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand shadow-xl shadow-black/30">
            <Leaf className="h-7 w-7 text-white" />
          </span>
          <h1 className="text-2xl font-extrabold tracking-wide text-white">ZUPONA</h1>
          <p className="mt-1 text-sm text-white/55">Admin Panel</p>
        </div>

        <div className="rounded-2xl bg-white p-6 shadow-2xl shadow-black/30">
          <h2 className="text-lg font-bold text-neutral-900">Welcome back</h2>
          <p className="mb-5 mt-1 text-sm text-neutral-500">
            Sign in with your administrator account to manage the store.
          </p>

          <LoginForm />

          <p className="mt-5 flex items-start gap-2 rounded-xl bg-neutral-50 px-3.5 py-2.5 text-[11px] leading-relaxed text-neutral-500">
            <ShieldCheck className="mt-px h-3.5 w-3.5 shrink-0 text-brand" />
            This area is restricted to Zupona staff. Every sign-in attempt is logged.
          </p>
        </div>

        <p className="mt-5 text-center text-xs text-white/35">
          © {new Date().getFullYear()} Zupona · All rights reserved
        </p>
      </div>
    </div>
  );
}
