const PREFIX = "daubo_onboarding_v1_done";
const PLAN_PROMPT_PENDING = "daubo_plan_prompt_pending";
const SELECTED_PLAN_PREFIX = "daubo_selected_plan_v1";

export function onboardingDoneKey(userId: string): string {
  return `${PREFIX}:${userId}`;
}

export function planPromptPendingKey(userId: string): string {
  return `${PLAN_PROMPT_PENDING}:${userId}`;
}

function selectedPlanKey(userId: string): string {
  return `${SELECTED_PLAN_PREFIX}:${userId}`;
}

export type SelectedPlanTier = "free_trial" | "pro" | "business";

export function isOnboardingDone(userId: string): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(onboardingDoneKey(userId)) === "1";
}

/** Marks onboarding complete; first completion also queues the post-onboarding plan picker (session). */
export function setOnboardingDone(userId: string): void {
  if (typeof window === "undefined") return;
  const key = onboardingDoneKey(userId);
  const wasDone = window.localStorage.getItem(key) === "1";
  window.localStorage.setItem(key, "1");
  if (!wasDone) {
    window.sessionStorage.setItem(planPromptPendingKey(userId), "1");
  }
}

export function isPlanPromptPending(userId: string): boolean {
  if (typeof window === "undefined") return false;
  return window.sessionStorage.getItem(planPromptPendingKey(userId)) === "1";
}

export function clearPlanPromptPending(userId: string): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(planPromptPendingKey(userId));
}

export function setSelectedPlanTier(userId: string, tier: SelectedPlanTier): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(selectedPlanKey(userId), tier);
}

export function getSelectedPlanTier(userId: string): SelectedPlanTier | null {
  if (typeof window === "undefined") return null;
  const v = window.localStorage.getItem(selectedPlanKey(userId));
  if (v === "free_trial" || v === "pro" || v === "business") return v;
  return null;
}
