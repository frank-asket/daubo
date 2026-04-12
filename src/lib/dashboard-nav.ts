/**
 * Single source of truth for dashboard sidebar labels and pathname → title mapping.
 * Add a route here once; use `dashboardNavLabel()` in the shell header.
 */

export const DASHBOARD_NAV_MAIN = [
  { href: "/dashboard", label: "Home" },
  { href: "/dashboard/applications", label: "My jobs" },
  { href: "/dashboard/resume", label: "My resume" },
  { href: "/dashboard/interviews", label: "Interview practice" },
] as const;

export const DASHBOARD_NAV_SECONDARY = [
  { href: "/dashboard/profile", label: "Profile" },
  { href: "/dashboard/settings", label: "Settings" },
  { href: "/dashboard/support", label: "Support" },
] as const;

export type DashboardNavItem = { href: string; label: string };

const ALL_NAV: readonly DashboardNavItem[] = [
  ...DASHBOARD_NAV_MAIN,
  ...DASHBOARD_NAV_SECONDARY,
];

/** Normalize pathname (strip trailing slash) and return the matching nav label, or "Home". */
export function dashboardNavLabel(pathname: string | null | undefined): string {
  let path = pathname?.trim() || "/dashboard";
  if (path !== "/" && path.endsWith("/")) {
    path = path.slice(0, -1);
  }
  const hit = ALL_NAV.find((n) => n.href === path);
  return hit?.label ?? "Home";
}
