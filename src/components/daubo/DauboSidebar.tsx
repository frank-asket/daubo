"use client";

import type { LucideIcon } from "lucide-react";
import {
  Asterisk,
  List,
  Check,
  Pencil,
  FileText,
  Bot,
  User,
  Settings,
  LifeBuoy,
} from "lucide-react";
import Link from "next/link";
import { useUser } from "@clerk/nextjs";
import { Logo } from "@/components/Logo";
import { useDashboardStats } from "@/components/dashboard/DashboardStatsContext";
import {
  DASHBOARD_NAV_MAIN,
  DASHBOARD_NAV_SECONDARY,
  DASHBOARD_NAV_SETUP,
} from "@/lib/dashboard-nav";

type MainNavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  badge?: string;
};

const ICON_MAIN: Record<string, LucideIcon> = {
  "/dashboard": Asterisk,
  "/dashboard/pipeline": List,
  "/dashboard/approvals": Check,
  "/dashboard/interviews": Pencil,
};

const ICON_SETUP: Record<string, LucideIcon> = {
  "/dashboard/resume": FileText,
  "/dashboard/agents": Bot,
};

const ICON_SECONDARY: Record<string, LucideIcon> = {
  "/dashboard/profile": User,
  "/dashboard/settings": Settings,
  "/dashboard/support": LifeBuoy,
};

const mainItems: MainNavItem[] = DASHBOARD_NAV_MAIN.map((n) => ({
  href: n.href,
  label: n.label,
  icon: ICON_MAIN[n.href] ?? Asterisk,
}));

const setupItems: MainNavItem[] = DASHBOARD_NAV_SETUP.map((n) => ({
  href: n.href,
  label: n.label,
  icon: ICON_SETUP[n.href] ?? FileText,
}));

const secondaryItems = DASHBOARD_NAV_SECONDARY.map((n) => ({
  href: n.href,
  label: n.label,
  icon: ICON_SECONDARY[n.href] ?? User,
}));

function routeCount(route: string, stats: ReturnType<typeof useDashboardStats>["stats"]): string | null {
  const total = stats?.application_count ?? 0;
  const career = stats?.career;
  switch (route) {
    case "/dashboard":
      return String(Math.max(total, career?.exploring ?? 0));
    case "/dashboard/pipeline":
      return String(total);
    case "/dashboard/approvals":
      return String((career?.ready_to_submit ?? 0) + (career?.package_ready ?? 0));
    default:
      return null;
  }
}

function mergeClassNames(...parts: (string | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}

export function DauboSidebar({
  active = "Home",
  logoHref = "/",
  className,
  onNavLinkClick,
}: {
  active?: string;
  /** Dashboard uses `/dashboard` so the logo returns to the workspace home, not marketing. */
  logoHref?: string;
  className?: string;
  onNavLinkClick?: () => void;
}) {
  const { stats } = useDashboardStats();
  const { user } = useUser();
  const displayName = user?.fullName?.trim() || user?.firstName?.trim() || "Daubo member";

  return (
    <aside
      id="dashboard-sidebar-nav"
      className={mergeClassNames(
        "flex w-[min(280px,92vw)] shrink-0 flex-col border-r border-zinc-200 bg-[#efefec] text-zinc-900 lg:w-[270px]",
        className,
      )}
    >
      <div className="flex h-28 flex-col items-start justify-center border-b border-zinc-300 px-6">
        <Logo href={logoHref} />
        <p className="mt-1 text-[12px] font-semibold uppercase tracking-wide text-emerald-700">Job Search AI</p>
      </div>
      <nav className="flex flex-1 flex-col overflow-y-auto px-4 py-6" aria-label="Dashboard">
        <p className="px-3 pb-2 text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500">Workspace</p>
        <div className="space-y-1">
          {mainItems.map((item) => {
          const Icon = item.icon;
          const isActive = active === item.label;
          const badge = routeCount(item.href, stats);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavLinkClick}
              aria-current={isActive ? "page" : undefined}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                isActive
                  ? "bg-white text-zinc-950 shadow-sm"
                  : "text-zinc-700 hover:bg-white/70 hover:text-zinc-950"
              }`}
            >
              <Icon className="h-4 w-4 shrink-0 opacity-80" strokeWidth={1.8} />
              <span className="flex-1">{item.label}</span>
              {badge ? (
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">
                  {badge}
                </span>
              ) : null}
            </Link>
          );
          })}
        </div>

        <p className="mt-8 px-3 pb-2 text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500">Setup</p>
        <div className="space-y-1">
          {setupItems.map((item) => {
            const Icon = item.icon;
            const isActive = active === item.label;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavLinkClick}
                aria-current={isActive ? "page" : undefined}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                  isActive
                    ? "bg-white text-zinc-950 shadow-sm"
                    : "text-zinc-700 hover:bg-white/70 hover:text-zinc-950"
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" strokeWidth={1.8} />
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>
      <div className="border-t border-zinc-300 p-3">
        <nav className="flex flex-col gap-0.5">
          {secondaryItems.map((item) => {
            const Icon = item.icon;
            const isActive = active === item.label;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavLinkClick}
                aria-current={isActive ? "page" : undefined}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                  isActive
                    ? "bg-white text-zinc-900"
                    : "text-zinc-600 hover:bg-white/70 hover:text-zinc-900"
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" strokeWidth={1.75} />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="mt-4 flex items-center gap-3 rounded-xl bg-white/70 px-3 py-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-100 text-sm font-semibold text-emerald-800">
            {(user?.firstName?.[0] ?? "D").toUpperCase()}
          </div>
          <p className="text-sm font-medium text-zinc-800">
            {displayName}
            <span className="block text-xs font-normal text-zinc-500">Pro plan</span>
          </p>
        </div>
      </div>
    </aside>
  );
}
