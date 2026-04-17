'use client'

import { useState, useRef, useEffect } from 'react'
import { Send, Bot, User, Loader2, RefreshCw, Zap } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAgentStore } from '@/stores'
import { useAgentStream, useOrchestratorChat } from '@/hooks'
import type { AgentState } from '@/types'

const AGENT_META: Record<string, { icon: string; color: string }> = {
  discovery:    { icon: '🔍', color: 'bg-brand-50 text-brand-800' },
  scorer:       { icon: '◆', color: 'bg-purple-bg text-purple-text' },
  tailor:       { icon: '✂', color: 'bg-info-bg text-info-text' },
  writer:       { icon: '✏', color: 'bg-warning-bg text-warning-text' },
  apply:        { icon: '📤', color: 'bg-danger-bg text-danger-text' },
  prep:         { icon: '🎯', color: 'bg-brand-50 text-brand-800' },
  monitor:      { icon: '⚙', color: 'bg-purple-bg text-purple-text' },
  orchestrator: { icon: '⊕', color: 'bg-info-bg text-info-text' },
}

const SUGGESTED_PROMPTS = [
  'What are my best opportunities right now?',
  'Why did a score drop recently?',
  'Draft a follow-up for my latest application',
  'What\'s stale in my pipeline?',
]

function StatusDot({ status }: { status: AgentState['status'] }) {
  return (
    <span className={cn(
      'w-2 h-2 rounded-full flex-shrink-0',
      status === 'running' && 'bg-warning-text animate-pulse',
      status === 'active'  && 'bg-brand-400',
      status === 'idle'    && 'bg-surface-300',
      status === 'error'   && 'bg-danger-border',
    )} />
  )
}

function AgentCard({ agent }: { agent: AgentState }) {
  const meta = AGENT_META[agent.name] ?? { icon: '●', color: 'bg-surface-100 text-surface-500' }
  return (
    <div className="card p-3.5 flex items-start gap-3">
      <div className={cn('w-8 h-8 rounded-md flex items-center justify-center text-sm flex-shrink-0', meta.color)}>
        {meta.icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <p className="text-sm font-medium text-surface-800">{agent.label}</p>
          <StatusDot status={agent.status} />
          <span className="text-2xs text-surface-400 capitalize">{agent.status}</span>
        </div>
        <p className="text-xs text-surface-500 truncate">{agent.description}</p>
        {agent.status === 'running' && agent.progress !== undefined && (
          <div className="mt-2 h-0.5 bg-surface-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-brand-400 rounded-full transition-all duration-500"
              style={{ width: `${Math.round(agent.progress * 100)}%` }}
            />
          </div>
        )}
        {agent.message && (
          <p className="text-2xs text-surface-400 mt-1 truncate">{agent.message}</p>
        )}
      </div>
      {agent.items_processed !== undefined && (
        <span className="text-2xs text-surface-400 tabular-nums flex-shrink-0">{agent.items_processed} items</span>
      )}
    </div>
  )
}

function ChatMessage({ role, text }: { role: 'user' | 'ai'; text: string }) {
  return (
    <div className={cn('flex items-start gap-2.5', role === 'user' && 'flex-row-reverse')}>
      <div className={cn(
        'w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0',
        role === 'ai' ? 'bg-brand-50 text-brand-600' : 'bg-surface-100 text-surface-500'
      )}>
        {role === 'ai' ? <Bot size={12} /> : <User size={12} />}
      </div>
      <div className={cn(
        'max-w-[80%] px-3 py-2 rounded-lg text-xs leading-relaxed',
        role === 'ai' ? 'bg-surface-50 border border-surface-200 text-surface-700' : 'bg-brand-400 text-white'
      )}>
        {text || <span className="animate-pulse opacity-60">●●●</span>}
      </div>
    </div>
  )
}

export default function AgentsPage() {
  const agents = useAgentStore((s) => s.agents)
  useAgentStream()

  const { messages, streaming, send } = useOrchestratorChat()
  const [input, setInput] = useState('')
  const chatEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  function handleSend() {
    const msg = input.trim()
    if (!msg || streaming) return
    setInput('')
    send(msg)
  }

  const activeCount = agents.filter((a) => a.status === 'active' || a.status === 'running').length

  // Fallback agents for display if SSE not yet connected
  const displayAgents: AgentState[] = agents.length > 0 ? agents : [
    { name: 'discovery', label: 'Discovery agent', description: 'Scans 45+ portals — Ashby, Greenhouse, Lever, Wellfound', status: 'active' },
    { name: 'scorer', label: 'Match scorer', description: 'Runs fit scoring (1–5) against your resume profile', status: 'running', progress: 0.6, message: 'Scoring 14 new jobs…' },
    { name: 'tailor', label: 'Resume tailor', description: 'Generates ATS-optimized resume variants per JD', status: 'active' },
    { name: 'writer', label: 'Cover letter writer', description: 'Drafts personalized cover letters and LinkedIn notes', status: 'active' },
    { name: 'apply', label: 'Apply agent', description: 'Executes channel-aware apply post-approval', status: 'idle' },
    { name: 'prep', label: 'Prep agent', description: 'Generates STAR-R questions and company briefings', status: 'active' },
    { name: 'monitor', label: 'Pipeline monitor', description: 'Deduplicates, normalizes statuses, flags stale entries', status: 'active' },
    { name: 'orchestrator', label: 'Orchestrator', description: 'Routes tasks, enforces approvals, prevents duplicate runs', status: 'running', progress: 0.3, message: 'Queuing tailor run…' },
  ]

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-surface-800">Agent status</h1>
          <p className="text-sm text-surface-500 mt-0.5">Multi-agent orchestration layer</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-brand-50 border border-brand-100 rounded-md">
            <Zap size={12} className="text-brand-600" />
            <span className="text-xs font-medium text-brand-800">{activeCount} agents active</span>
          </div>
          <button className="btn text-xs gap-1.5">
            <RefreshCw size={13} />
            Refresh
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Agent grid */}
        <div>
          <p className="text-xs text-surface-400 uppercase tracking-wider font-medium mb-3">Agent roster</p>
          <div className="space-y-2">
            {displayAgents.map((agent) => (
              <AgentCard key={agent.name} agent={agent} />
            ))}
          </div>
        </div>

        {/* Orchestrator chat */}
        <div className="flex flex-col">
          <p className="text-xs text-surface-400 uppercase tracking-wider font-medium mb-3">Orchestrator chat</p>
          <div className="card flex flex-col flex-1 min-h-[520px]">
            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full gap-4 py-8">
                  <div className="w-10 h-10 rounded-full bg-brand-50 flex items-center justify-center">
                    <Bot size={18} className="text-brand-600" />
                  </div>
                  <p className="text-xs text-surface-400 text-center">Ask me anything about your pipeline</p>
                  <div className="grid grid-cols-1 gap-2 w-full">
                    {SUGGESTED_PROMPTS.map((p) => (
                      <button
                        key={p}
                        onClick={() => send(p)}
                        className="text-xs text-left px-3 py-2 rounded-md bg-surface-50 border border-surface-200 hover:bg-surface-100 hover:border-surface-300 transition-colors text-surface-600"
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                messages.map((m, i) => (
                  <ChatMessage key={i} role={m.role} text={m.text} />
                ))
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Input */}
            <div className="border-t border-surface-100 p-3">
              <div className="flex items-center gap-2">
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
                  placeholder="Ask the orchestrator…"
                  className="field text-xs py-2 flex-1"
                  disabled={streaming}
                />
                <button
                  onClick={handleSend}
                  disabled={!input.trim() || streaming}
                  className="btn btn-primary p-2 aspect-square"
                >
                  {streaming
                    ? <Loader2 size={13} className="animate-spin" />
                    : <Send size={13} />
                  }
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
