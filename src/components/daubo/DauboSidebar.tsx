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
import { useDashboardStatsOptional } from "@/components/dashboard/DashboardStatsContext";
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

function routeCount(
  route: string,
  stats: ReturnType<typeof useDashboardStatsOptional> extends { stats: infer S } ? S : unknown,
): string | null {
  if (!stats || typeof stats !== "object") return null;
  const s = stats as {
    application_count?: number;
    career?: { exploring?: number; ready_to_submit?: number; package_ready?: number };
  };
  const total = s.application_count ?? 0;
  const career = s.career;
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
  const statsCtx = useDashboardStatsOptional();
  const stats = statsCtx?.stats ?? null;
  const { user } = useUser();
  const displayName = user?.fullName?.trim() || user?.firstName?.trim() || "Daubo member";

  return (
    <aside
      id="dashboard-sidebar-nav"
      className={mergeClassNames(
        "flex w-[min(320px,92vw)] shrink-0 flex-col border-r border-zinc-800/90 bg-[#0a0a0a] text-zinc-50 lg:w-[312px]",
        className,
      )}
    >
      <div className="flex h-28 flex-col items-start justify-center border-b border-zinc-800/90 px-6">
        <Logo href={logoHref} />
        <p className="mt-1 text-[12px] font-semibold uppercase tracking-wide text-emerald-400">Job Search AI</p>
      </div>
      <nav className="flex flex-1 flex-col overflow-y-auto px-2 py-2" aria-label="Dashboard">
        <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-zinc-500">Workspace</p>
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
              className={`flex items-center gap-3 rounded-md px-3 py-2 text-[13px] font-medium transition ${
                isActive
                  ? "bg-zinc-800/90 text-white"
                  : "text-zinc-500 hover:bg-zinc-900 hover:text-zinc-200"
              }`}
            >
              <Icon className="h-4 w-4 shrink-0 opacity-80" strokeWidth={1.8} />
              <span className="flex-1">{item.label}</span>
              {badge ? (
                <span className="rounded-[9px] bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-200">
                  {badge}
                </span>
              ) : null}
            </Link>
          );
          })}
        </div>

        <p className="mt-4 px-3 pb-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-zinc-500">Setup</p>
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
                className={`flex items-center gap-3 rounded-md px-3 py-2 text-[13px] font-medium transition ${
                  isActive
                    ? "bg-zinc-800/90 text-white"
                    : "text-zinc-500 hover:bg-zinc-900 hover:text-zinc-200"
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" strokeWidth={1.8} />
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>
      <div className="border-t border-zinc-800/90 p-3">
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
                    ? "bg-zinc-800/60 text-zinc-200"
                    : "text-zinc-500 hover:bg-zinc-900 hover:text-zinc-200"
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" strokeWidth={1.75} />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="mt-4 flex items-center gap-3 rounded-xl border border-zinc-800 bg-gradient-to-br from-zinc-900/80 to-zinc-950 px-3 py-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-500/15 text-sm font-semibold text-emerald-200">
            {(user?.firstName?.[0] ?? "D").toUpperCase()}
          </div>
          <p className="text-sm font-medium text-zinc-200">
            {displayName}
            <span className="block text-xs font-normal text-zinc-500">Pro plan</span>
          </p>
        </div>
      </div>
    </aside>
  );
}
