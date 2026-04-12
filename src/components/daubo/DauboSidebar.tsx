import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  Briefcase,
  FileText,
  MessageSquare,
  User,
  Settings,
  LifeBuoy,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { Logo } from "@/components/Logo";
import { DASHBOARD_NAV_MAIN, DASHBOARD_NAV_SECONDARY } from "@/lib/dashboard-nav";

type MainNavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  badge?: string;
};

const ICON_MAIN: Record<string, LucideIcon> = {
  "/dashboard": LayoutDashboard,
  "/dashboard/applications": Briefcase,
  "/dashboard/resume": FileText,
  "/dashboard/interviews": MessageSquare,
};

const ICON_SECONDARY: Record<string, LucideIcon> = {
  "/dashboard/profile": User,
  "/dashboard/settings": Settings,
  "/dashboard/support": LifeBuoy,
};

const main: MainNavItem[] = DASHBOARD_NAV_MAIN.map((n) => ({
  href: n.href,
  label: n.label,
  icon: ICON_MAIN[n.href] ?? LayoutDashboard,
}));

const secondary = DASHBOARD_NAV_SECONDARY.map((n) => ({
  href: n.href,
  label: n.label,
  icon: ICON_SECONDARY[n.href] ?? User,
}));

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
  return (
    <aside
      id="dashboard-sidebar-nav"
      className={mergeClassNames(
        "flex w-[min(260px,88vw)] shrink-0 flex-col border-r border-zinc-800/90 bg-[#0a0a0a] lg:w-[220px]",
        className,
      )}
    >
      <div className="flex h-14 items-center border-b border-zinc-800/90 px-4">
        <Logo href={logoHref} />
      </div>
      <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto p-3" aria-label="Dashboard">
        {main.map((item) => {
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
                  ? "bg-zinc-800/90 text-white"
                  : "text-zinc-500 hover:bg-zinc-900 hover:text-zinc-200"
              }`}
            >
              <Icon className="h-4 w-4 shrink-0 opacity-80" strokeWidth={1.75} />
              <span className="flex-1">{item.label}</span>
              {item.badge ? (
                <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-zinc-950">
                  {item.badge}
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-zinc-800/90 p-3">
        <nav className="flex flex-col gap-0.5">
          {secondary.map((item) => {
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
        <div className="mt-3 rounded-xl border border-zinc-800 bg-gradient-to-br from-zinc-900/80 to-zinc-950 p-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-zinc-200">
            <Sparkles className="h-3.5 w-3.5 text-emerald-400" />
            Help
          </div>
          <p className="mt-1 text-[11px] leading-snug text-zinc-500">
            <strong className="font-medium text-zinc-400">Coach</strong> (bottom-right) explains how Daubo
            works. <strong className="font-medium text-zinc-400">Web job search</strong> in the sidebar
            (when enabled) searches live postings and may use your résumé excerpt—separate from Coach.
          </p>
        </div>
      </div>
    </aside>
  );
}
