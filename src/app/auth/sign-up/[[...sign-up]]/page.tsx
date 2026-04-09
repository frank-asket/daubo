import { SignUp } from "@clerk/nextjs";
import { clerkAppearance } from "@/lib/clerk-appearance";

export default function AuthSignUpPage() {
  return (
    <SignUp
      appearance={clerkAppearance}
      path="/auth/sign-up"
      routing="path"
      signInUrl="/auth/sign-in"
      fallbackRedirectUrl="/dashboard"
      forceRedirectUrl="/dashboard"
    />
  );
}
