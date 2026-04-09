import { SignIn } from "@clerk/nextjs";
import Link from "next/link";
import { clerkAppearance } from "@/lib/clerk-appearance";

export default function SignInPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-black px-4 py-12">
      <Link
        href="/"
        className="mb-8 text-sm font-medium text-zinc-500 transition hover:text-zinc-300"
      >
        ← Back to Daubo
      </Link>
      <SignIn
        appearance={clerkAppearance}
        fallbackRedirectUrl="/dashboard"
        forceRedirectUrl="/dashboard"
      />
    </div>
  );
}
