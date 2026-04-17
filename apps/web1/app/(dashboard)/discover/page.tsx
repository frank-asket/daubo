'use client'

import { useState } from 'react'
import { RefreshCw, SlidersHorizontal, Globe, ChevronDown, ChevronUp, ArrowRight, X, BookOpen } from 'lucide-react'
import { cn, fitClass, fitLabel, channelLabel, channelBadgeClass, relativeTime, scoreBarWidth } from '@/lib/utils'
import { useJobStore } from '@/stores'
import { useJobs } from '@/hooks'
import { applicationsApi } from '@/lib/api'
import type { JobWithScore } from '@/types'

const STAT_CARDS = [
  { label: 'Evaluated this week', value: '148', sub: 'across 45+ portals' },
  { label: 'High fit (≥ 4.0)', value: '12', sub: 'ready to review' },
  { label: 'Avg fit score', value: '3.4', sub: 'all discovered roles' },
  { label: 'Applied', value: '7', sub: 'awaiting response' },
]

const DIMENSION_LABELS: Record<string, string> = {
  tech: 'Tech match', culture: 'Culture', seniority: 'Seniority', comp: 'Compensation', location: 'Location',
}

function FitBadge({ score }: { score: number }) {
  return (
    <span className={cn('badge text-xs px-2 py-0.5', fitClass(score))}>
      {score.toFixed(1)}
    </span>
  )
}

function ScoreBar({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-24 text-xs text-surface-400 flex-shrink-0">{DIMENSION_LABELS[label] ?? label}</span>
      <div className="flex-1 h-1 bg-surface-100 rounded-full overflow-hidden">
        <div
          className="h-full bg-brand-400 rounded-full transition-all duration-500"
          style={{ width: `${scoreBarWidth(value)}%` }}
        />
      </div>
      <span className="w-6 text-xs text-surface-500 text-right tabular-nums">{value.toFixed(1)}</span>
    </div>
  )
}

function JobCard({ job }: { job: JobWithScore }) {
  const [expanded, setExpanded] = useState(false)
  const [queuing, setQueuing] = useState(false)
  const [queued, setQueued] = useState(false)
  const dismissJob = useJobStore((s) => s.dismissJob)

  async function handleQueue() {
    setQueuing(true)
    try {
      await applicationsApi.create(job.id, job.score.channel_recommendation)
      setQueued(true)
    } catch {
      // optimistic anyway in demo
      setQueued(true)
    } finally {
      setQueuing(false)
    }
  }

  return (
    <div className={cn('card animate-fade-in transition-all', queued && 'opacity-60 pointer-events-none')}>
      <div className="p-4">
        {/* Top row */}
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-md bg-surface-100 flex items-center justify-center text-xs font-semibold text-surface-500 flex-shrink-0 border border-surface-200">
              {job.company.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <p className="text-sm font-medium text-surface-800 leading-snug">{job.title}</p>
              <p className="text-xs text-surface-500 mt-0.5">{job.company}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <FitBadge score={job.score.fit_score} />
            <button
              onClick={() => dismissJob(job.id)}
              className="text-surface-300 hover:text-surface-500 transition-colors"
            >
              <X size={13} />
            </button>
          </div>
        </div>

        {/* Meta */}
        <div className="flex flex-wrap gap-3 mb-3">
          <span className="text-xs text-surface-400">📍 {job.location}</span>
          {job.salary_range && (
            <span className="text-xs text-surface-400">💰 {job.salary_range}</span>
          )}
          <span className={cn('badge text-2xs', channelBadgeClass(job.score.channel_recommendation))}>
            via {channelLabel(job.score.channel_recommendation)}
          </span>
          <span className="text-xs text-surface-300">{relativeTime(job.discovered_at)}</span>
        </div>

        {/* Expand/collapse */}
        <button
          onClick={() => setExpanded((x) => !x)}
          className="flex items-center gap-1 text-xs text-surface-400 hover:text-surface-600 transition-colors mb-3"
        >
          {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          {expanded ? 'Less detail' : 'View fit breakdown'}
        </button>

        {expanded && (
          <div className="space-y-4 pb-1 animate-slide-up">
            {/* Reasons */}
            <div>
              <p className="text-2xs text-surface-400 uppercase tracking-wider mb-1.5 font-medium">Why it matches</p>
              <ul className="space-y-1">
                {job.score.fit_reasons.map((r, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-surface-600">
                    <span className="w-1 h-1 rounded-full bg-brand-400 mt-1.5 flex-shrink-0" />
                    {r}
                  </li>
                ))}
              </ul>
            </div>

            {/* Risks */}
            {job.score.risk_flags.length > 0 && (
              <div>
                <p className="text-2xs text-surface-400 uppercase tracking-wider mb-1.5 font-medium">Watch out</p>
                <ul className="space-y-1">
                  {job.score.risk_flags.map((r, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs text-danger-text">
                      <span className="w-1 h-1 rounded-full bg-danger-border mt-1.5 flex-shrink-0" />
                      {r}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Score bars */}
            <div>
              <p className="text-2xs text-surface-400 uppercase tracking-wider mb-2 font-medium">Fit dimensions</p>
              <div className="space-y-1.5">
                {Object.entries(job.score.dimension_scores).map(([k, v]) => (
                  <ScoreBar key={k} label={k} value={v} />
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2 pt-2 border-t border-surface-100">
          {queued ? (
            <span className="text-xs text-brand-600 font-medium">✓ Added to queue</span>
          ) : (
            <button
              onClick={handleQueue}
              disabled={queuing}
              className="btn btn-primary text-xs gap-1.5"
            >
              {queuing ? 'Preparing…' : 'Prepare application'}
              {!queuing && <ArrowRight size={12} />}
            </button>
          )}
          <button className="btn text-xs gap-1.5">
            <BookOpen size={12} />
            Interview prep
          </button>
          <a href={job.url} target="_blank" rel="noopener noreferrer" className="btn btn-ghost text-xs ml-auto">
            View JD ↗
          </a>
        </div>
      </div>
    </div>
  )
}

function JobSkeleton() {
  return (
    <div className="card p-4 space-y-3">
      <div className="flex gap-3">
        <div className="skeleton w-9 h-9 rounded-md flex-shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="skeleton h-3.5 w-48 rounded" />
          <div className="skeleton h-3 w-28 rounded" />
        </div>
        <div className="skeleton h-5 w-10 rounded-full" />
      </div>
      <div className="flex gap-3">
        <div className="skeleton h-3 w-24 rounded" />
        <div className="skeleton h-3 w-20 rounded" />
      </div>
    </div>
  )
}

export default function DiscoverPage() {
  const { jobs, total, loading, minFit, setMinFit } = useJobStore()
  const { refresh } = useJobs()
  const [filterOpen, setFilterOpen] = useState(false)

  const filteredJobs = jobs.filter((j) => !minFit || j.score.fit_score >= minFit)

  return (
    <div className="p-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-surface-800">Discover</h1>
          <p className="text-sm text-surface-500 mt-0.5">AI-matched roles based on your resume and preferences</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setFilterOpen((x) => !x)}
            className={cn('btn text-xs gap-1.5', filterOpen && 'bg-surface-100 border-surface-300')}
          >
            <SlidersHorizontal size={13} />
            Filters
          </button>
          <button onClick={() => refresh()} className="btn text-xs gap-1.5">
            <RefreshCw size={13} className={cn(loading && 'animate-spin-slow')} />
            Refresh
          </button>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        {STAT_CARDS.map((s) => (
          <div key={s.label} className="bg-surface-100 rounded-lg p-3">
            <p className="text-2xs text-surface-400 uppercase tracking-wider mb-1">{s.label}</p>
            <p className="text-2xl font-semibold text-surface-800 tabular-nums">{s.value}</p>
            <p className="text-2xs text-surface-400 mt-0.5">{s.sub}</p>
          </div>
        ))}
      </div>

      {/* Filters panel */}
      {filterOpen && (
        <div className="card p-4 mb-4 animate-slide-up">
          <p className="text-xs font-medium text-surface-600 mb-3">Filter jobs</p>
          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2 text-xs text-surface-600">
              Min fit score
              <select
                className="field w-24 text-xs py-1"
                value={minFit}
                onChange={(e) => setMinFit(Number(e.target.value))}
              >
                <option value={0}>Any</option>
                <option value={3}>3.0+</option>
                <option value={3.5}>3.5+</option>
                <option value={4}>4.0+</option>
                <option value={4.5}>4.5+</option>
              </select>
            </label>
            <label className="flex items-center gap-2 text-xs text-surface-600">
              <Globe size={12} />
              Location
              <input className="field w-32 text-xs py-1" placeholder="e.g. Remote" />
            </label>
          </div>
        </div>
      )}

      {/* Job list */}
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs text-surface-400 font-medium uppercase tracking-wider">
          Top matches · {filteredJobs.length} shown
        </p>
      </div>

      <div className="space-y-3">
        {loading
          ? Array.from({ length: 4 }).map((_, i) => <JobSkeleton key={i} />)
          : filteredJobs.length === 0
          ? (
            <div className="text-center py-16 text-surface-400">
              <Globe size={28} className="mx-auto mb-3 opacity-40" />
              <p className="text-sm font-medium text-surface-500">No matches yet</p>
              <p className="text-xs mt-1">Upload your resume and click Refresh to discover roles</p>
            </div>
          )
          : filteredJobs.map((job) => <JobCard key={job.id} job={job} />)
        }
      </div>
    </div>
  )
}
