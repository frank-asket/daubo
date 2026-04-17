'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import {
  Compass, ListFilter, CheckSquare, BookOpen,
  FileText, Cpu, ChevronRight, Bell, Settings, LogOut,
} from 'lucide-react'
import { cn, initials } from '@/lib/utils'
import { useApprovalStore } from '@/stores'

const NAV = [
  { href: '/discover',  label: 'Discover',      icon: Compass,      badge: 'jobs' },
  { href: '/pipeline',  label: 'Pipeline',       icon: ListFilter,   badge: 'pipeline' },
  { href: '/approvals', label: 'Approvals',      icon: CheckSquare,  badge: 'approvals', urgent: true },
  { href: '/prep',      label: 'Interview prep', icon: BookOpen,     badge: null },
  { href: '/resume',    label: 'My resume',      icon: FileText,     badge: null },
  { href: '/agents',    label: 'Agents',         icon: Cpu,          badge: null },
]

function NavItem({
  href, label, icon: Icon, count, urgent,
}: {
  href: string; label: string; icon: React.ElementType; count?: number; urgent?: boolean
}) {
  const path = usePathname()
  const active = path === href || path.startsWith(href + '/')

  return (
    <Link
      href={href}
      className={cn(
        'group flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-all duration-150',
        active
          ? 'bg-white text-surface-800 font-medium shadow-card'
          : 'text-surface-500 hover:bg-surface-100 hover:text-surface-700'
      )}
    >
      <Icon
        size={15}
        className={cn(active ? 'text-brand-400' : 'text-surface-400 group-hover:text-surface-500')}
      />
      <span className="flex-1">{label}</span>
      {count !== undefined && count > 0 && (
        <span
          className={cn(
            'text-2xs px-1.5 py-0.5 rounded-full font-medium tabular-nums',
            urgent ? 'bg-warning-bg text-warning-text' : 'bg-brand-50 text-brand-800'
          )}
        >
          {count}
        </span>
      )}
    </Link>
  )
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const approvals = useApprovalStore((s) => s.approvals)
  const pendingCount = approvals.filter((a) => a.status === 'pending').length

  const counts: Record<string, number> = {
    approvals: pendingCount,
  }

  return (
    <div className="flex h-screen overflow-hidden bg-surface-50">
      {/* Sidebar */}
      <aside className="w-[224px] flex-shrink-0 flex flex-col border-r border-surface-200 bg-surface-50">
        {/* Logo */}
        <div className="px-5 pt-5 pb-4 border-b border-surface-200">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-md bg-brand-400 flex items-center justify-center">
              <ChevronRight size={14} className="text-white" strokeWidth={3} />
            </div>
            <span className="text-base font-semibold text-surface-800 tracking-tight">Daubo</span>
          </div>
          <p className="text-2xs text-surface-400 mt-1 ml-9">Job search AI</p>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto">
          {NAV.map((item) => (
            <NavItem
              key={item.href}
              href={item.href}
              label={item.label}
              icon={item.icon}
              count={item.badge ? counts[item.badge] : undefined}
              urgent={item.urgent}
            />
          ))}
        </nav>

        {/* Footer */}
        <div className="border-t border-surface-200 p-3 space-y-1">
          <button className="w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm text-surface-500 hover:bg-surface-100 hover:text-surface-700 transition-colors">
            <Bell size={15} />
            <span>Notifications</span>
          </button>
          <button className="w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm text-surface-500 hover:bg-surface-100 hover:text-surface-700 transition-colors">
            <Settings size={15} />
            <span>Settings</span>
          </button>
          <div className="flex items-center gap-2.5 px-3 py-2 mt-1">
            <div className="w-6 h-6 rounded-full bg-brand-50 flex items-center justify-center text-2xs font-medium text-brand-800 flex-shrink-0">
              FL
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-surface-700 truncate">Franck L.</p>
              <p className="text-2xs text-surface-400 truncate">Pro</p>
            </div>
            <button className="text-surface-400 hover:text-surface-600">
              <LogOut size={13} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  )
}
