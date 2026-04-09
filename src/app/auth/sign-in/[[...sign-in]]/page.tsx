import { SignIn } from "@clerk/nextjs";
import { clerkAppearance } from "@/lib/clerk-appearance";

export default function AuthSignInPage() {
  return (
    <SignIn
      appearance={clerkAppearance}
      path="/auth/sign-in"
      routing="path"
      signUpUrl="/auth/sign-up"
      fallbackRedirectUrl="/dashboard"
      forceRedirectUrl="/dashboard"
    />
  );
}
