'use client'

import { useState } from 'react'
import { ChevronDown, ChevronUp, Sparkles, Loader2, BookOpen, Building2, MessageSquare, RefreshCw } from 'lucide-react'
import { cn, relativeTime } from '@/lib/utils'
import { prepApi } from '@/lib/api'
import type { PrepSession, StarStory } from '@/types'

// ── Mock data for standalone demo ─────────────────────────────────────────

const MOCK_SESSIONS: PrepSession[] = [
  {
    id: '1',
    application: {
      id: 'a1',
      user_id: 'u1',
      job: {
        id: 'j1', source: 'ashby', external_id: 'x1',
        title: 'Senior ML Engineer', company: 'Mistral AI',
        location: 'Remote · Paris', description: '', url: 'https://mistral.ai',
        discovered_at: new Date(Date.now() - 86400000 * 2).toISOString(),
      },
      status: 'pending', channel: 'email',
      last_updated: new Date().toISOString(), is_stale: false,
    },
    questions: [
      'Walk me through a production RAG system you built end-to-end.',
      'How do you approach latency vs. accuracy trade-offs in retrieval?',
      'Describe a time you debugged a silent failure in an agentic pipeline.',
      'How would you improve multilingual retrieval for open-weight models?',
      'Tell me about a project where you had to own technical decisions under ambiguity.',
    ],
    star_stories: [
      {
        situation: 'Our retail client needed real-time product search across 50M vectors with sub-200ms P99 latency.',
        task: 'Design and ship a hybrid retrieval system combining dense embeddings and BM25 within 6 weeks.',
        action: 'Architected a two-stage retrieval pipeline: ANN with HNSW for recall, BM25 re-ranker for precision. Added metadata filtering at the vector level to avoid post-filter bottlenecks.',
        result: 'Achieved 178ms P99, 94% NDCG@10, and reduced infra cost 40% vs. the previous full-text system.',
        reflection: 'Should have added query-level caching from day one — we added it in sprint 3 and got another 30ms reduction.',
        tags: ['RAG', 'retrieval', 'infra', 'MLOps'],
      },
    ],
    company_brief: undefined,
    created_at: new Date(Date.now() - 3600000).toISOString(),
  },
  {
    id: '2',
    application: {
      id: 'a2',
      user_id: 'u1',
      job: {
        id: 'j2', source: 'greenhouse', external_id: 'x2',
        title: 'AI Product Engineer', company: 'Linear',
        location: 'Remote', description: '', url: 'https://linear.app',
        discovered_at: new Date(Date.now() - 86400000 * 3).toISOString(),
      },
      status: 'interview', channel: 'linkedin',
      last_updated: new Date().toISOString(), is_stale: false,
    },
    questions: [
      'How do you balance AI capability with product UX constraints?',
      'Describe your experience shipping AI features to non-technical users.',
      'Walk me through how you instrument and evaluate an AI feature post-launch.',
      "What's your mental model for when to fine-tune vs. prompt-engineer?",
    ],
    star_stories: [],
    company_brief: undefined,
    created_at: new Date(Date.now() - 7200000).toISOString(),
  },
]

// ── Sub-components ─────────────────────────────────────────────────────────

function StarStoryCard({ story, index }: { story: StarStory; index: number }) {
  const [open, setOpen] = useState(index === 0)
  const sections: [string, string][] = [
    ['Situation', story.situation],
    ['Task', story.task],
    ['Action', story.action],
    ['Result', story.result],
    ['Reflection', story.reflection],
  ]
  return (
    <div className="border border-surface-200 rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen((x) => !x)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-surface-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-2xs font-medium text-brand-600 bg-brand-50 px-2 py-0.5 rounded-full">
            Story {index + 1}
          </span>
          <span className="text-xs font-medium text-surface-700 line-clamp-1">
            {story.situation.slice(0, 64)}…
          </span>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0 ml-2">
          <div className="flex gap-1">
            {story.tags.map((t) => (
              <span key={t} className="text-2xs px-1.5 py-0.5 bg-surface-100 text-surface-500 rounded">
                {t}
              </span>
            ))}
          </div>
          {open ? <ChevronUp size={13} className="text-surface-400" /> : <ChevronDown size={13} className="text-surface-400" />}
        </div>
      </button>

      {open && (
        <div className="border-t border-surface-100 divide-y divide-surface-100 animate-slide-up">
          {sections.map(([label, text]) => (
            <div key={label} className="px-4 py-3 flex gap-3">
              <span className="text-2xs font-semibold text-brand-600 uppercase tracking-wider w-20 flex-shrink-0 pt-0.5">
                {label}
              </span>
              <p className="text-xs text-surface-700 leading-relaxed">{text}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function QuestionList({ questions }: { questions: string[] }) {
  return (
    <div className="space-y-2">
      {questions.map((q, i) => (
        <div
          key={i}
          className="flex items-start gap-3 px-4 py-3 rounded-lg border border-surface-100 hover:border-surface-200 hover:bg-surface-50 transition-colors"
        >
          <span className="text-xs font-semibold text-brand-600 tabular-nums flex-shrink-0 w-5">
            Q{i + 1}
          </span>
          <p className="text-xs text-surface-700 leading-relaxed">{q}</p>
        </div>
      ))}
    </div>
  )
}

type Tab = 'questions' | 'stories' | 'brief'

function PrepSessionCard({ session }: { session: PrepSession }) {
  const [activeTab, setActiveTab] = useState<Tab>('questions')
  const [generatingStory, setGeneratingStory] = useState(false)
  const [generatingBrief, setGeneratingBrief] = useState(false)
  const [storyOutput, setStoryOutput] = useState('')
  const [briefOutput, setBriefOutput] = useState(session.company_brief ?? '')
  const [localStories, setLocalStories] = useState<StarStory[]>(session.star_stories)

  async function generateStarStory() {
    setGeneratingStory(true)
    setActiveTab('stories')
    setStoryOutput('')
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 700,
          stream: true,
          system: 'You are Daubo, an AI job search assistant. Generate a specific, concrete STAR-R interview story. Be precise and quantitative.',
          messages: [{
            role: 'user',
            content: `Generate a STAR-R story for an AI/ML engineer interviewing at ${session.application.job.company} for ${session.application.job.title}. Demonstrate building a production system. Include: Situation, Task, Action, Result (with metrics), and Reflection. Format with clear labels.`,
          }],
        }),
      })
      const reader = res.body!.getReader()
      const dec = new TextDecoder()
      let text = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        for (const line of dec.decode(value).split('\n')) {
          if (!line.startsWith('data:')) continue
          const raw = line.slice(5).trim()
          if (raw === '[DONE]') break
          try {
            const p = JSON.parse(raw)
            if (p.delta?.type === 'text_delta') { text += p.delta.text; setStoryOutput(text) }
          } catch {}
        }
      }
    } finally {
      setGeneratingStory(false)
    }
  }

  async function generateBrief() {
    setGeneratingBrief(true)
    setActiveTab('brief')
    setBriefOutput('')
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 500,
          stream: true,
          system: 'You are Daubo. Create a concise company brief for interview preparation.',
          messages: [{
            role: 'user',
            content: `Company brief for ${session.application.job.company} — ${session.application.job.title} role. Cover: (1) what the company does and recent news, (2) tech stack signals from public info, (3) culture and engineering values, (4) 2 smart questions to ask interviewers. Be specific and concise.`,
          }],
        }),
      })
      const reader = res.body!.getReader()
      const dec = new TextDecoder()
      let text = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        for (const line of dec.decode(value).split('\n')) {
          if (!line.startsWith('data:')) continue
          const raw = line.slice(5).trim()
          if (raw === '[DONE]') break
          try {
            const p = JSON.parse(raw)
            if (p.delta?.type === 'text_delta') { text += p.delta.text; setBriefOutput(text) }
          } catch {}
        }
      }
    } finally {
      setGeneratingBrief(false)
    }
  }

  const tabs: { key: Tab; label: string; count?: number }[] = [
    { key: 'questions', label: 'Questions', count: session.questions.length },
    { key: 'stories', label: 'STAR-R stories', count: localStories.length },
    { key: 'brief', label: 'Company brief' },
  ]

  return (
    <div className="card animate-fade-in">
      {/* Card header */}
      <div className="p-4 border-b border-surface-100">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-md bg-surface-100 border border-surface-200 flex items-center justify-center text-xs font-semibold text-surface-500 flex-shrink-0">
              {session.application.job.company.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <p className="text-sm font-medium text-surface-800">{session.application.job.company}</p>
              <p className="text-xs text-surface-500">{session.application.job.title}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={cn(
              'badge text-xs',
              session.application.status === 'interview' ? 'badge-interview' : 'badge-pending'
            )}>
              {session.application.status}
            </span>
            <span className="text-2xs text-surface-400">{relativeTime(session.created_at)}</span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-3 border-b border-surface-100 bg-surface-50">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              'px-3 py-1.5 rounded-md text-xs transition-all duration-150 flex items-center gap-1.5',
              activeTab === tab.key
                ? 'bg-white text-surface-800 font-medium shadow-card border border-surface-200'
                : 'text-surface-500 hover:text-surface-700 hover:bg-surface-100'
            )}
          >
            {tab.label}
            {tab.count !== undefined && (
              <span className="text-2xs tabular-nums text-surface-400">{tab.count}</span>
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="p-4">
        {activeTab === 'questions' && (
          <div className="animate-fade-in">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs text-surface-400 font-medium">Tailored to your resume + this JD</p>
              <button className="btn text-xs gap-1.5">
                <RefreshCw size={12} />
                Regenerate
              </button>
            </div>
            <QuestionList questions={session.questions} />
          </div>
        )}

        {activeTab === 'stories' && (
          <div className="animate-fade-in">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs text-surface-400 font-medium">STAR + Reflection method</p>
              <button
                onClick={generateStarStory}
                disabled={generatingStory}
                className="btn btn-primary text-xs gap-1.5"
              >
                {generatingStory ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                {generatingStory ? 'Generating…' : 'Generate story'}
              </button>
            </div>

            {localStories.length > 0 && (
              <div className="space-y-2 mb-4">
                {localStories.map((s, i) => <StarStoryCard key={i} story={s} index={i} />)}
              </div>
            )}

            {(generatingStory || storyOutput) && (
              <div className="bg-surface-50 border border-surface-200 rounded-lg p-4 text-xs text-surface-700 leading-relaxed whitespace-pre-wrap animate-fade-in">
                {storyOutput}
                {generatingStory && (
                  <span className="inline-block w-0.5 h-3 bg-brand-400 animate-pulse ml-0.5 align-middle" />
                )}
              </div>
            )}

            {!localStories.length && !storyOutput && !generatingStory && (
              <div className="text-center py-10 text-surface-400">
                <MessageSquare size={24} className="mx-auto mb-2 opacity-40" />
                <p className="text-xs">No stories yet — click Generate to create your first STAR-R story</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'brief' && (
          <div className="animate-fade-in">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs text-surface-400 font-medium">Company intelligence for your interview</p>
              <button
                onClick={generateBrief}
                disabled={generatingBrief}
                className="btn btn-primary text-xs gap-1.5"
              >
                {generatingBrief ? <Loader2 size={12} className="animate-spin" /> : <Building2 size={12} />}
                {generatingBrief ? 'Researching…' : 'Generate brief'}
              </button>
            </div>

            {(briefOutput || generatingBrief) ? (
              <div className="bg-surface-50 border border-surface-200 rounded-lg p-4 text-xs text-surface-700 leading-relaxed whitespace-pre-wrap">
                {briefOutput}
                {generatingBrief && (
                  <span className="inline-block w-0.5 h-3 bg-brand-400 animate-pulse ml-0.5 align-middle" />
                )}
              </div>
            ) : (
              <div className="text-center py-10 text-surface-400">
                <Building2 size={24} className="mx-auto mb-2 opacity-40" />
                <p className="text-xs">Generate a brief to see recent news, tech stack signals, and smart questions to ask</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Action bar */}
      <div className="px-4 pb-4 flex items-center gap-2 border-t border-surface-100 pt-3">
        <button onClick={generateStarStory} disabled={generatingStory} className="btn text-xs gap-1.5">
          <Sparkles size={12} />
          New STAR-R story
        </button>
        <button onClick={generateBrief} disabled={generatingBrief} className="btn text-xs gap-1.5">
          <Building2 size={12} />
          Company brief
        </button>
      </div>
    </div>
  )
}

function PrepSkeleton() {
  return (
    <div className="card p-4 space-y-3">
      <div className="flex gap-3">
        <div className="skeleton w-9 h-9 rounded-md flex-shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="skeleton h-3.5 w-36 rounded" />
          <div className="skeleton h-3 w-24 rounded" />
        </div>
      </div>
      <div className="skeleton h-8 w-full rounded-lg" />
      <div className="space-y-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="skeleton h-9 rounded-lg" />
        ))}
      </div>
    </div>
  )
}

export default function PrepPage() {
  const [sessions] = useState<PrepSession[]>(MOCK_SESSIONS)
  const [loading] = useState(false)

  return (
    <div className="p-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-surface-800">Interview prep</h1>
          <p className="text-sm text-surface-500 mt-0.5">STAR-R stories, tailored questions, and company briefs</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-surface-100 rounded-md">
            <BookOpen size={12} className="text-surface-500" />
            <span className="text-xs text-surface-500">{sessions.length} sessions</span>
          </div>
        </div>
      </div>

      {/* Info banner */}
      <div className="flex items-start gap-2.5 p-3.5 bg-brand-50 border border-brand-100 rounded-lg mb-5">
        <Sparkles size={14} className="text-brand-600 mt-0.5 flex-shrink-0" />
        <p className="text-xs text-brand-800">
          <span className="font-medium">Prep is tailored per application.</span>{' '}
          Questions and STAR-R stories are generated from your resume + the specific job description.
        </p>
      </div>

      {/* Sessions */}
      <div className="space-y-4">
        {loading
          ? Array.from({ length: 2 }).map((_, i) => <PrepSkeleton key={i} />)
          : sessions.length === 0
          ? (
            <div className="text-center py-16 text-surface-400">
              <BookOpen size={28} className="mx-auto mb-3 opacity-40" />
              <p className="text-sm font-medium text-surface-500">No prep sessions yet</p>
              <p className="text-xs mt-1">Prep sessions are created when you queue an application</p>
            </div>
          )
          : sessions.map((s) => <PrepSessionCard key={s.id} session={s} />)
        }
      </div>
    </div>
  )
}
