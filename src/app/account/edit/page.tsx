import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { requireUser } from "@/lib/session";
import EditProfileForm from "@/components/account/EditProfileForm";

export default async function EditProfilePage() {
  const user = await requireUser();

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col bg-brand-mist pb-10">
      <header className="flex items-center gap-3 border-b border-line-soft bg-white px-4 py-3">
        <Link href="/account" aria-label="Back to account">
          <ChevronLeft className="h-5 w-5 text-ink" />
        </Link>
        <h1 className="text-base font-bold text-heading">Edit Profile</h1>
      </header>
      <main className="flex-1 px-4 pt-4">
        <EditProfileForm user={user} />
      </main>
    </div>
  );
}
