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

const main = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/dashboard/applications", label: "Applications", icon: Briefcase },
  { href: "/dashboard/resume", label: "Resume", icon: FileText },
  {
    href: "/dashboard/interviews",
    label: "Interview prep",
    icon: MessageSquare,
    badge: "New",
  },
];

const secondary = [
  { href: "/dashboard/profile", label: "Profile", icon: User },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
  { href: "/dashboard/support", label: "Support", icon: LifeBuoy },
];

export function DauboSidebar({
  active = "Dashboard",
}: {
  active?: string;
}) {
  return (
    <aside className="flex w-[220px] shrink-0 flex-col border-r border-zinc-800/90 bg-[#0a0a0a]">
      <div className="flex h-14 items-center border-b border-zinc-800/90 px-4">
        <Logo href="/" />
      </div>
      <nav className="flex flex-1 flex-col gap-0.5 p-3" aria-label="Dashboard">
        {main.map((item) => {
          const Icon = item.icon;
          const isActive = active === item.label;
          return (
            <Link
              key={item.href}
              href={item.href}
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
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-zinc-500 transition hover:bg-zinc-900 hover:text-zinc-200"
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
            Daubo Pro
          </div>
          <p className="mt-1 text-[11px] leading-snug text-zinc-500">
            Tailored resumes per job, apply from your inbox, prep included
          </p>
        </div>
      </div>
    </aside>
  );
}
