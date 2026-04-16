"use client";

import { UserButton } from "@clerk/nextjs";
import { Bell, Menu, Search, X } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { DauboSidebar } from "@/components/daubo/DauboSidebar";
import { DashboardCopilotKit } from "@/components/dashboard/DashboardCopilotKit";
import { DashboardStatsProvider } from "@/components/dashboard/DashboardStatsContext";
import { DauboAssistantPanel } from "@/components/dashboard/DauboAssistantPanel";
import { OnboardingWalkthrough } from "@/components/dashboard/OnboardingWalkthrough";
import { PostOnboardingPlanModal } from "@/components/dashboard/PostOnboardingPlanModal";
import { ResumeNudgeBanner } from "@/components/dashboard/ResumeNudgeBanner";
import { dashboardNavLabel } from "@/lib/dashboard-nav";

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const path = usePathname() ?? "/dashboard";
  const router = useRouter();
  const searchParams = useSearchParams();
  const active = dashboardNavLabel(path);

  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [searchDraft, setSearchDraft] = useState("");

  const notifRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const closeMobileNav = useCallback(() => setMobileNavOpen(false), []);
  const closeNotif = useCallback(() => setNotifOpen(false), []);

  useEffect(() => {
    closeMobileNav();
  }, [path, closeMobileNav]);

  useEffect(() => {
    if (path === "/dashboard/applications" || path === "/dashboard/pipeline") {
      setSearchDraft(searchParams.get("q") ?? "");
    } else {
      setSearchDraft("");
    }
  }, [path, searchParams]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        closeNotif();
        closeMobileNav();
      }
      if (e.key === "/" && !e.metaKey && !e.ctrlKey && !e.altKey) {
        const t = e.target as HTMLElement | null;
        if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) {
          return;
        }
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [closeMobileNav, closeNotif]);

  useEffect(() => {
    if (!notifOpen) return;
    function handlePointer(e: MouseEvent) {
      if (notifRef.current?.contains(e.target as Node)) return;
      closeNotif();
    }
    document.addEventListener("mousedown", handlePointer);
    return () => document.removeEventListener("mousedown", handlePointer);
  }, [notifOpen, closeNotif]);

  function onSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    const q = searchDraft.trim();
    if (q) {
      router.push(`/dashboard/pipeline?q=${encodeURIComponent(q)}`);
    } else {
      router.push("/dashboard/pipeline");
    }
    closeMobileNav();
  }

  return (
    <DashboardStatsProvider>
      {/*
        Skip link stays outside CopilotKit so it remains first in document order before any
        Copilot UI (wrapped in DashboardCopilotKit). Dashboard content is nested inside
        CopilotSidebar so CopilotKit’s layout CSS applies to the shell.
      */}
      <a
        href="#dashboard-main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[300] focus:rounded-lg focus:bg-emerald-400 focus:px-4 focus:py-2.5 focus:text-sm focus:font-semibold focus:text-zinc-950 focus:shadow-lg focus:outline-none"
      >
        Skip to main content
      </a>
      <DashboardCopilotKit>
      <div className="flex min-h-screen bg-[#efefec] text-zinc-900">
        <OnboardingWalkthrough />
        <PostOnboardingPlanModal />

        <div
          className={`fixed inset-0 z-40 bg-black/70 backdrop-blur-sm transition-opacity lg:hidden ${
            mobileNavOpen ? "opacity-100" : "pointer-events-none opacity-0"
          }`}
          aria-hidden={!mobileNavOpen}
          onClick={closeMobileNav}
        />

        <DauboSidebar
          active={active}
          logoHref="/dashboard"
          onNavLinkClick={closeMobileNav}
          className={`fixed inset-y-0 left-0 z-50 transform transition-transform duration-200 ease-out lg:static lg:z-auto lg:translate-x-0 ${
            mobileNavOpen ? "translate-x-0 shadow-2xl shadow-black/50" : "-translate-x-full lg:translate-x-0"
          }`}
        />

        <div className="flex min-w-0 flex-1 flex-col bg-[#f7f5ef] lg:min-h-screen">
          <ResumeNudgeBanner />
          <header className="sticky top-0 z-30 border-b border-zinc-200 bg-[#f7f5ef]/95 backdrop-blur-md">
            <div className="flex flex-col gap-3 px-3 py-3 sm:px-4 sm:py-4 lg:flex-row lg:items-center lg:justify-between lg:gap-4">
              <div className="flex min-w-0 items-start gap-2 sm:items-center sm:gap-3">
                <button
                  type="button"
                  className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-100 hover:text-zinc-950 lg:hidden"
                  aria-expanded={mobileNavOpen}
                  aria-controls="dashboard-sidebar-nav"
                  aria-label={mobileNavOpen ? "Close menu" : "Open menu"}
                  onClick={() => setMobileNavOpen((o) => !o)}
                >
                  {mobileNavOpen ? <X className="h-5 w-5" strokeWidth={1.75} /> : <Menu className="h-5 w-5" strokeWidth={1.75} />}
                </button>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] text-zinc-500 sm:text-[11px]">Daubo</p>
                  <h2 className="truncate text-base font-semibold tracking-tight text-zinc-950 sm:text-lg md:text-xl">
                    {active}
                  </h2>
                </div>
              </div>

              <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center sm:justify-end lg:w-auto lg:max-w-[min(100%,42rem)] lg:flex-1">
                <form
                  onSubmit={onSearchSubmit}
                  className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-zinc-300 bg-white px-2.5 py-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] sm:px-3 sm:py-2"
                  role="search"
                >
                  <Search className="h-4 w-4 shrink-0 text-zinc-400" strokeWidth={1.75} aria-hidden />
                  <input
                    ref={searchInputRef}
                    type="search"
                    name="q"
                    value={searchDraft}
                    onChange={(e) => setSearchDraft(e.target.value)}
                    placeholder="Search my jobs… ( / to focus )"
                    className="min-w-0 flex-1 bg-transparent text-sm text-zinc-900 placeholder:text-zinc-400 outline-none"
                    autoComplete="off"
                    aria-label="Search my jobs"
                  />
                  <button
                    type="submit"
                    className="hidden shrink-0 rounded-lg bg-zinc-950 px-2 py-1 text-[11px] font-medium text-white hover:bg-zinc-800 sm:inline"
                  >
                    Go
                  </button>
                </form>

                <div className="flex shrink-0 items-center justify-end gap-2 sm:gap-3">
                  <div className="relative" ref={notifRef}>
                    <button
                      type="button"
                      className={`rounded-xl border p-2 transition ${
                        notifOpen
                          ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700"
                          : "border-zinc-300 bg-white text-zinc-500 hover:text-zinc-900"
                      }`}
                      aria-label="Notifications"
                      aria-expanded={notifOpen}
                      aria-haspopup="true"
                      onClick={() => setNotifOpen((v) => !v)}
                    >
                      <Bell className="h-4 w-4" strokeWidth={1.75} />
                    </button>
                    {notifOpen ? (
                      <div
                        className="absolute right-0 top-[calc(100%+0.5rem)] z-50 w-[min(calc(100vw-1.5rem),20rem)] rounded-xl border border-zinc-200 bg-white p-3 shadow-xl shadow-zinc-300/50"
                        role="dialog"
                        aria-label="Notifications"
                      >
                        <p className="text-xs font-semibold text-zinc-950">Notifications</p>
                        <p className="mt-2 text-[11px] leading-relaxed text-zinc-600">
                          Job reminders aren’t turned on yet. Use{" "}
                          <strong className="text-zinc-900">Coach</strong> (bottom-right) for how-to help, or
                          open <strong className="text-zinc-900">Web job search</strong> in the sidebar when
                          it’s available for live posting search.
                        </p>
                        <div className="mt-3 flex flex-col gap-2">
                          <Link
                            href="/dashboard/settings"
                            className="text-[11px] font-medium text-emerald-400 hover:underline"
                            onClick={closeNotif}
                          >
                            Email &amp; settings →
                          </Link>
                          <Link
                            href="/dashboard/support"
                            className="text-[11px] font-medium text-zinc-600 hover:text-emerald-500 hover:underline"
                            onClick={closeNotif}
                          >
                            Help &amp; Support →
                          </Link>
                        </div>
                      </div>
                    ) : null}
                  </div>

                  <UserButton
                    appearance={{
                      elements: {
                        userButtonAvatarBox: "h-9 w-9 ring-1 ring-zinc-300 sm:h-10 sm:w-10",
                      },
                    }}
                  />
                </div>
              </div>
            </div>
          </header>
          <div
            id="dashboard-main"
            role="main"
            tabIndex={-1}
            className="flex-1 scroll-mt-2 overflow-auto pb-[env(safe-area-inset-bottom)] outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40"
          >
            {children}
          </div>
          <DauboAssistantPanel />
        </div>
      </div>
      </DashboardCopilotKit>
    </DashboardStatsProvider>
  );
}
