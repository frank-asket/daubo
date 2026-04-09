import type { Metadata } from "next";
import { AuthBrandingPanel } from "@/components/auth/AuthBrandingPanel";

export const metadata: Metadata = {
  title: "Account — Daubo",
  description:
    "Sign in or create your Daubo account—track jobs, tailor application materials from your résumé, and use optional Gmail drafts you send yourself.",
};

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-black text-zinc-50 antialiased">
      <div className="flex min-h-screen flex-col lg:grid lg:grid-cols-[minmax(280px,420px)_1fr]">
        <AuthBrandingPanel />
        <main className="flex flex-1 items-center justify-center px-4 py-10 sm:px-8">
          <div className="w-full max-w-[420px]">{children}</div>
        </main>
      </div>
    </div>
  );
}
