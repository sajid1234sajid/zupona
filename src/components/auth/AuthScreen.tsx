import AuthForm from "./AuthForm";
import BottomNav from "@/components/layout/BottomNav";
import DesktopHeader from "@/components/layout/DesktopHeader";
import type { AuthActionState } from "@/app/account/actions";
import ZuponaMark from "@/components/brand/ZuponaMark";

interface AuthScreenProps {
  mode: "signup" | "login";
  title: string;
  subtitle: string;
  action: (state: AuthActionState, formData: FormData) => Promise<AuthActionState>;
  initialError?: string;
}

export default function AuthScreen({ mode, title, subtitle, action, initialError }: AuthScreenProps) {
  return (
    <div className="relative flex min-h-screen w-full flex-col overflow-hidden bg-gradient-to-b from-brand-tint via-white to-white">
      <DesktopHeader />
      <div className="relative mx-auto flex w-full max-w-md flex-1 flex-col px-6 pb-28 pt-14 tab:pb-16 tab:pt-12">
        <div className="mb-8 flex flex-col items-center text-center">
          <ZuponaMark className="mb-4 h-14 w-14" />
          <h1 className="text-2xl font-bold text-brand-darkest">{title}</h1>
          <p className="mt-2 max-w-xs text-sm text-ink-slate">{subtitle}</p>
        </div>

        <AuthForm mode={mode} action={action} initialError={initialError} />
      </div>

      <BottomNav />
    </div>
  );
}
