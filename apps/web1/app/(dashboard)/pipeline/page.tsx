'use client'

import { useState } from 'react'
import { AlertTriangle, ChevronRight, RefreshCw, Loader2 } from 'lucide-react'
import { cn, statusBadgeClass, channelBadgeClass, channelLabel, shortDate, fitClass } from '@/lib/utils'
import { usePipelineStore } from '@/stores'
import { usePipeline } from '@/hooks'
import { applicationsApi } from '@/lib/api'
import type { ApplicationStatus, IntegrityChange } from '@/types'

const STATUS_TABS: { label: string; value: ApplicationStatus | 'all' }[] = [
  { label: 'All', value: 'all' },
  { label: 'Applied', value: 'applied' },
  { label: 'Interview', value: 'interview' },
  { label: 'Pending', value: 'pending' },
  { label: 'Rejected', value: 'rejected' },
]

function ChangeRow({ change }: { change: IntegrityChange }) {
  const label = {
    deduplicate: '⊕ Deduplicate',
    mark_stale: '⏱ Mark stale',
    normalize_status: '↻ Normalize status',
  }[change.type]

  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-surface-100 last:border-0">
      <span className={cn(
        'badge text-2xs mt-0.5',
        change.type === 'deduplicate' ? 'badge-interview' :
        change.type === 'mark_stale' ? 'badge-pending' : 'badge-applied'
      )}>
        {label}
      </span>
      <p className="text-xs text-surface-600 flex-1">{change.reason}</p>
      <button className="text-2xs text-brand-600 hover:underline whitespace-nowrap">
        Jump to row
      </button>
    </div>
  )
}

export default function PipelinePage() {
  const { applications, integrityResult, integrityLoading, setIntegrityResult, setIntegrityLoading } = usePipelineStore()
  const { refresh } = usePipeline()
  const [activeTab, setActiveTab] = useState<ApplicationStatus | 'all'>('all')
  const [applying, setApplying] = useState(false)

  const filtered = activeTab === 'all'
    ? applications
    : applications.filter((a) => a.status === activeTab)

  async function runIntegrity(mode: 'dry_run' | 'apply') {
    if (mode === 'apply') setApplying(true)
    else setIntegrityLoading(true)
    try {
      const result = await applicationsApi.integrityCheck(mode)
      setIntegrityResult(result)
      if (mode === 'apply') refresh()
    } catch {
      // handle error
    } finally {
      setIntegrityLoading(false)
      setApplying(false)
    }
  }

  const hasIntegrityIssues = applications.some((a) => a.is_stale || a.dedup_group)

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-surface-800">Pipeline</h1>
          <p className="text-sm text-surface-500 mt-0.5">Track and manage all your applications</p>
        </div>
        <button onClick={() => refresh()} className="btn text-xs gap-1.5">
          <RefreshCw size={13} />
          Refresh
        </button>
      </div>

      {/* Integrity banner */}
      {hasIntegrityIssues && !integrityResult && (
        <div className="flex items-start gap-3 p-3.5 bg-warning-bg border border-warning-border rounded-lg mb-5 animate-fade-in">
          <AlertTriangle size={15} className="text-warning-text mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium text-warning-text">Integrity issues detected</p>
            <p className="text-xs text-warning-text/80 mt-0.5">Possible duplicates and stale entries found</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => runIntegrity('dry_run')}
              disabled={integrityLoading}
              className="btn text-xs gap-1.5 border-warning-border text-warning-text hover:bg-warning-bg"
            >
              {integrityLoading ? <Loader2 size={12} className="animate-spin" /> : null}
              Preview cleanup
            </button>
          </div>
        </div>
      )}

      {/* Integrity result */}
      {integrityResult && (
        <div className="card p-4 mb-5 animate-slide-up">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-sm font-medium text-surface-800">Integrity check results</p>
              <p className="text-xs text-surface-400 mt-0.5">
                {integrityResult.mode === 'dry_run' ? 'Preview — no changes applied yet' : 'Changes applied'}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="badge badge-pending text-xs">{integrityResult.summary.duplicates} dupes</span>
              <span className="badge badge-rejected text-xs">{integrityResult.summary.stale} stale</span>
              <span className="badge badge-applied text-xs">{integrityResult.summary.status_fixes} fixes</span>
            </div>
          </div>
          <div className="divide-y divide-surface-100">
            {integrityResult.changes.map((c, i) => <ChangeRow key={i} change={c} />)}
          </div>
          {integrityResult.mode === 'dry_run' && (
            <div className="flex gap-2 mt-3 pt-3 border-t border-surface-100">
              <button
                onClick={() => runIntegrity('apply')}
                disabled={applying}
                className="btn btn-primary text-xs"
              >
                {applying ? <Loader2 size={12} className="animate-spin" /> : null}
                Apply all changes
              </button>
              <button onClick={() => setIntegrityResult(null)} className="btn text-xs">
                Dismiss
              </button>
            </div>
          )}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-surface-100 rounded-lg mb-4 w-fit">
        {STATUS_TABS.map((tab) => {
          const count = tab.value === 'all'
            ? applications.length
            : applications.filter((a) => a.status === tab.value).length
          return (
            <button
              key={tab.value}
              onClick={() => setActiveTab(tab.value)}
              className={cn(
                'px-3 py-1.5 rounded-md text-xs transition-all duration-150',
                activeTab === tab.value
                  ? 'bg-white text-surface-800 font-medium shadow-card'
                  : 'text-surface-500 hover:text-surface-700'
              )}
            >
              {tab.label}
              {count > 0 && (
                <span className="ml-1.5 text-2xs text-surface-400 tabular-nums">{count}</span>
              )}
            </button>
          )
        })}
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-surface-100">
              {['Company', 'Role', 'Fit', 'Channel', 'Status', 'Last update', ''].map((h) => (
                <th key={h} className="text-left py-2.5 px-4 text-2xs text-surface-400 uppercase tracking-wider font-medium">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-12 text-center text-xs text-surface-400">
                  No applications in this category yet
                </td>
              </tr>
            ) : (
              filtered.map((app) => (
                <tr key={app.id} className="border-b border-surface-100 hover:bg-surface-50 transition-colors group">
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded bg-surface-100 flex items-center justify-center text-2xs font-semibold text-surface-500 border border-surface-200">
                        {app.job.company.slice(0, 2).toUpperCase()}
                      </div>
                      <span className="text-sm font-medium text-surface-700">{app.job.company}</span>
                      {app.is_stale && (
                        <span className="badge bg-warning-bg text-warning-text text-2xs">stale</span>
                      )}
                    </div>
                  </td>
                  <td className="py-3 px-4 text-sm text-surface-600 max-w-[180px] truncate">{app.job.title}</td>
                  <td className="py-3 px-4">
                    {app.score && (
                      <span className={cn('badge text-xs', fitClass(app.score.fit_score))}>
                        {app.score.fit_score.toFixed(1)}
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4">
                    <span className={cn('badge text-xs', channelBadgeClass(app.channel))}>
                      {channelLabel(app.channel)}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <span className={cn('badge text-xs', statusBadgeClass(app.status))}>
                      {app.status}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-xs text-surface-400 tabular-nums">
                    {app.applied_at ? shortDate(app.applied_at) : '—'}
                  </td>
                  <td className="py-3 px-4">
                    <button className="opacity-0 group-hover:opacity-100 transition-opacity text-surface-400 hover:text-surface-600">
                      <ChevronRight size={14} />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
