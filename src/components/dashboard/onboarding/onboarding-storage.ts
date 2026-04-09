const PREFIX = "daubo_onboarding_v1_done";

export function onboardingDoneKey(userId: string): string {
  return `${PREFIX}:${userId}`;
}

export function isOnboardingDone(userId: string): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(onboardingDoneKey(userId)) === "1";
}

export function setOnboardingDone(userId: string): void {
  window.localStorage.setItem(onboardingDoneKey(userId), "1");
}
