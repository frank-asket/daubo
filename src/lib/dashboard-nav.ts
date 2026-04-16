/**
 * Single source of truth for dashboard sidebar labels and pathname → title mapping.
 * Add a route here once; use `dashboardNavLabel()` in the shell header.
 */

export const DASHBOARD_NAV_MAIN = [
  { href: "/dashboard", label: "Discover" },
  { href: "/dashboard/pipeline", label: "Pipeline" },
  { href: "/dashboard/approvals", label: "Approvals" },
  { href: "/dashboard/interviews", label: "Interview prep" },
] as const;

export const DASHBOARD_NAV_SETUP = [
  { href: "/dashboard/resume", label: "My resume" },
  { href: "/dashboard/agents", label: "Agent status" },
] as const;

export const DASHBOARD_NAV_SECONDARY = [
  { href: "/dashboard/profile", label: "Profile" },
  { href: "/dashboard/settings", label: "Settings" },
  { href: "/dashboard/support", label: "Support" },
] as const;

export type DashboardNavItem = { href: string; label: string };

const ALL_NAV: readonly DashboardNavItem[] = [
  ...DASHBOARD_NAV_MAIN,
  ...DASHBOARD_NAV_SETUP,
  ...DASHBOARD_NAV_SECONDARY,
];

/** Normalize pathname (strip trailing slash) and return the matching nav label, or "Discover". */
export function dashboardNavLabel(pathname: string | null | undefined): string {
  let path = pathname?.trim() || "/dashboard";
  if (path !== "/" && path.endsWith("/")) {
    path = path.slice(0, -1);
  }
  if (path === "/dashboard/applications") path = "/dashboard/pipeline";
  const hit = ALL_NAV.find((n) => n.href === path);
  return hit?.label ?? "Discover";
}
