import { useEffect, useRef, useState, useCallback } from 'react'
import useSWR from 'swr'
import { jobsApi, applicationsApi, approvalsApi, agentsApi, streamAgentStatus } from '@/lib/api'
import { useJobStore, usePipelineStore, useApprovalStore, useAgentStore } from '@/stores'
import type { AgentState, AgentName } from '@/types'

// ─── useJobs ───────────────────────────────────────────────────────────────

export function useJobs() {
  const { minFit, locationFilter, setJobs, setLoading } = useJobStore()

  const { data, error, isLoading, mutate } = useSWR(
    ['jobs', minFit, locationFilter],
    () => jobsApi.list({ min_fit: minFit || undefined, location: locationFilter || undefined }),
    { revalidateOnFocus: false, dedupingInterval: 30_000 }
  )

  useEffect(() => {
    if (data) setJobs(data.items, data.total)
    setLoading(isLoading)
  }, [data, isLoading])

  return { error, refresh: mutate }
}

// ─── usePipeline ───────────────────────────────────────────────────────────

export function usePipeline(statusFilter?: string) {
  const { setApplications, setLoading } = usePipelineStore()

  const { data, error, isLoading, mutate } = useSWR(
    ['applications', statusFilter],
    () => applicationsApi.list(statusFilter),
    { revalidateOnFocus: false }
  )

  useEffect(() => {
    if (data) setApplications(data.items)
    setLoading(isLoading)
  }, [data, isLoading])

  return { error, refresh: mutate }
}

// ─── useApprovals ──────────────────────────────────────────────────────────

export function useApprovals() {
  const { setApprovals, setLoading } = useApprovalStore()

  const { data, error, isLoading, mutate } = useSWR(
    'approvals',
    () => approvalsApi.list(),
    { revalidateOnFocus: true, refreshInterval: 15_000 }
  )

  useEffect(() => {
    if (data) setApprovals(data)
    setLoading(isLoading)
  }, [data, isLoading])

  return { error, refresh: mutate }
}

// ─── useAgentStream ────────────────────────────────────────────────────────

export function useAgentStream() {
  const { setAgents, updateAgent } = useAgentStore()

  // Initial fetch
  const { data } = useSWR('agents', agentsApi.status, {
    revalidateOnFocus: false,
    dedupingInterval: 60_000,
  })
  useEffect(() => { if (data) setAgents(data) }, [data])

  // SSE stream for live updates
  useEffect(() => {
    const stop = streamAgentStatus((event) => {
      updateAgent(event.name as AgentName, event)
    })
    return stop
  }, [])
}

// ─── useOrchestratorChat ───────────────────────────────────────────────────

export function useOrchestratorChat() {
  const [messages, setMessages] = useState<Array<{ role: 'user' | 'ai'; text: string }>>([])
  const [streaming, setStreaming] = useState(false)
  const stopRef = useRef<(() => void) | null>(null)

  const send = useCallback(
    async (text: string, apiBase = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000') => {
      setMessages((m) => [...m, { role: 'user', text }])
      setStreaming(true)
      let acc = ''

      setMessages((m) => [...m, { role: 'ai', text: '' }])

      // Use Anthropic API directly for demo; replace with backend stream in prod
      try {
        const res = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 600,
            stream: true,
            system:
              'You are Daubo, an AI job search orchestrator. Answer questions about a user\'s job pipeline concisely and professionally. The pipeline has 7 applications, 3 pending approvals, and 12 high-fit matches.',
            messages: [{ role: 'user', content: text }],
          }),
        })

        const reader = res.body!.getReader()
        const dec = new TextDecoder()

        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          const lines = dec.decode(value).split('\n')
          for (const line of lines) {
            if (!line.startsWith('data:')) continue
            const raw = line.slice(5).trim()
            if (raw === '[DONE]') break
            try {
              const parsed = JSON.parse(raw)
              if (parsed.delta?.type === 'text_delta') {
                acc += parsed.delta.text
                setMessages((m) => [
                  ...m.slice(0, -1),
                  { role: 'ai', text: acc },
                ])
              }
            } catch {}
          }
        }
      } catch (e: any) {
        setMessages((m) => [
          ...m.slice(0, -1),
          { role: 'ai', text: `Error: ${e.message}` },
        ])
      } finally {
        setStreaming(false)
      }
    },
    []
  )

  const stop = useCallback(() => {
    stopRef.current?.()
    setStreaming(false)
  }, [])

  return { messages, streaming, send, stop }
}

// ─── useResumeUpload ───────────────────────────────────────────────────────

export function useResumeUpload() {
  const [uploading, setUploading] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [analysis, setAnalysis] = useState<string>('')
  const [error, setError] = useState<string | null>(null)

  const upload = useCallback(async (file: File) => {
    setUploading(true)
    setError(null)
    try {
      // In prod: call resumeApi.upload(file)
      await new Promise((r) => setTimeout(r, 1200))
      return { success: true }
    } catch (e: any) {
      setError(e.message)
      return { success: false }
    } finally {
      setUploading(false)
    }
  }, [])

  const analyzeWithAI = useCallback(
    async (role: string, skills: string) => {
      setAnalyzing(true)
      setAnalysis('')
      try {
        const res = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 500,
            stream: true,
            system:
              'You are Daubo, an AI job search assistant. Analyze this candidate profile briefly.',
            messages: [
              {
                role: 'user',
                content: `Target role: ${role}. Skills: ${skills}. Give: (1) top 3 role archetypes, (2) 2 skill gaps, (3) 3 recommended companies to target. Be specific and concise.`,
              },
            ],
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
              if (p.delta?.type === 'text_delta') {
                text += p.delta.text
                setAnalysis(text)
              }
            } catch {}
          }
        }
      } catch (e: any) {
        setAnalysis(`Error: ${e.message}`)
      } finally {
        setAnalyzing(false)
      }
    },
    []
  )

  return { upload, uploading, analyzeWithAI, analyzing, analysis, error }
}
