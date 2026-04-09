const PREFIX = "daubo_getting_started_dismissed_v1";

export function gettingStartedDismissKey(userId: string): string {
  return `${PREFIX}:${userId}`;
}

export function isGettingStartedDismissed(userId: string): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(gettingStartedDismissKey(userId)) === "1";
}

export function setGettingStartedDismissed(userId: string): void {
  window.localStorage.setItem(gettingStartedDismissKey(userId), "1");
}
