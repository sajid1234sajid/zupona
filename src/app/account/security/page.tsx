import Link from "next/link";
import { ChevronLeft, ShieldCheck, Calendar } from "lucide-react";
import { requireUser } from "@/lib/session";
import { getDB } from "@/lib/db";
import ChangePasswordForm from "@/components/account/ChangePasswordForm";

export default async function SecurityPage() {
  const user = await requireUser();
  const db = await getDB();
  const row = await db
    .prepare("SELECT password_hash FROM users WHERE id = ?")
    .bind(user.id)
    .first<{ password_hash: string | null }>();
  const hasPassword = Boolean(row?.password_hash);

  const memberSince = new Date(`${user.createdAt.replace(" ", "T")}Z`).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col bg-[#f3f5f4] pb-10">
      <header className="flex items-center gap-3 border-b border-line-soft bg-white px-4 py-3">
        <Link href="/account" aria-label="Back to account">
          <ChevronLeft className="h-5 w-5 text-ink" />
        </Link>
        <h1 className="text-base font-bold text-heading">Profile &amp; Security</h1>
      </header>
      <main className="flex-1 px-4 pt-4">
        <div className="mb-3 flex items-center gap-3 rounded-2xl bg-white p-4 shadow-card">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-tint text-brand">
            <ShieldCheck className="h-5 w-5" />
          </span>
          <div>
            <p className="text-sm font-semibold text-heading">Verified Account</p>
            <p className="text-xs text-ink-slate">{user.email ?? user.phone}</p>
          </div>
        </div>

        <div className="mb-3 flex items-center gap-3 rounded-2xl bg-white p-4 shadow-card">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-tint text-brand">
            <Calendar className="h-5 w-5" />
          </span>
          <div>
            <p className="text-sm font-semibold text-heading">Member since</p>
            <p className="text-xs text-ink-slate">{memberSince}</p>
          </div>
        </div>

        <h2 className="mb-2 mt-4 text-sm font-bold text-heading">
          {hasPassword ? "Change Password" : "Set a Password"}
        </h2>
        <ChangePasswordForm hasPassword={hasPassword} />
      </main>
    </div>
  );
}
