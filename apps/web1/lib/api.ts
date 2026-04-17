import type {
  JobWithScore, Application, IntegrityCheckResult,
  AutopilotRun, AutopilotScope, Approval, PrepSession,
  AgentState, ResumeProfile, UserPreferences, PaginatedResponse,
} from '@/types'

const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'

class ApiError extends Error {
  constructor(public status: number, public detail: string) {
    super(detail)
  }
}

async function request<T>(
  path: string,
  init: RequestInit = {},
  headers: Record<string, string> = {},
): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
      ...init.headers,
    },
    credentials: 'include',
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new ApiError(res.status, body.detail ?? res.statusText)
  }
  return res.json()
}

// ─── Jobs ──────────────────────────────────────────────────────────────────

export const jobsApi = {
  list: (params: { min_fit?: number; location?: string; page?: number } = {}) => {
    const q = new URLSearchParams()
    if (params.min_fit)   q.set('min_fit', String(params.min_fit))
    if (params.location)  q.set('location', params.location)
    if (params.page)      q.set('page', String(params.page))
    return request<PaginatedResponse<JobWithScore>>(`/v1/jobs?${q}`)
  },
  dismiss: (jobId: string) =>
    request<void>(`/v1/jobs/${jobId}/dismiss`, { method: 'POST' }),
}

// ─── Applications ──────────────────────────────────────────────────────────

export const applicationsApi = {
  list: (status?: string) => {
    const q = status ? `?status=${status}` : ''
    return request<PaginatedResponse<Application>>(`/v1/me/applications${q}`)
  },
  create: (jobId: string, channel: string) =>
    request<Application>('/v1/me/applications', {
      method: 'POST',
      body: JSON.stringify({ job_id: jobId, channel }),
    }),
  integrityCheck: (mode: 'dry_run' | 'apply') =>
    request<IntegrityCheckResult>('/v1/me/applications/integrity-check', {
      method: 'POST',
      body: JSON.stringify({ mode }),
    }),
}

// ─── Autopilot ─────────────────────────────────────────────────────────────

export const autopilotApi = {
  run: (
    scope: AutopilotScope,
    applicationIds: string[] | null,
    idempotencyKey: string,
  ) =>
    request<AutopilotRun>(
      '/v1/me/autopilot/run',
      {
        method: 'POST',
        body: JSON.stringify({ scope, application_ids: applicationIds }),
      },
      { 'Idempotency-Key': idempotencyKey },
    ),
  getRun: (runId: string) =>
    request<AutopilotRun>(`/v1/me/autopilot/runs/${runId}`),
}

// ─── Approvals ─────────────────────────────────────────────────────────────

export const approvalsApi = {
  list: () => request<Approval[]>('/v1/me/approvals'),
  approve: (id: string, editedBody?: string) =>
    request<{ approval_id: string; queued_send: boolean }>(`/v1/me/approvals/${id}/approve`, {
      method: 'POST',
      body: JSON.stringify({ edited_body: editedBody ?? null }),
    }),
  reject: (id: string) =>
    request<void>(`/v1/me/approvals/${id}/reject`, { method: 'POST' }),
}

// ─── Prep ──────────────────────────────────────────────────────────────────

export const prepApi = {
  getForApplication: (applicationId: string) =>
    request<PrepSession>(`/v1/me/prep?application_id=${applicationId}`),
  generate: (applicationId: string) =>
    request<PrepSession>('/v1/me/prep/generate', {
      method: 'POST',
      body: JSON.stringify({ application_id: applicationId }),
    }),
}

// ─── Resume ────────────────────────────────────────────────────────────────

export const resumeApi = {
  get: () => request<ResumeProfile>('/v1/me/resume'),
  upload: (file: File) => {
    const form = new FormData()
    form.append('file', file)
    return request<ResumeProfile>('/v1/me/resume', {
      method: 'POST',
      body: form,
      headers: {},
    })
  },
  updatePreferences: (prefs: Partial<UserPreferences>) =>
    request<UserPreferences>('/v1/me/preferences', {
      method: 'PATCH',
      body: JSON.stringify(prefs),
    }),
  analyzeProfile: () =>
    request<{ analysis: string }>('/v1/me/resume/analyze', { method: 'POST' }),
}

// ─── Agents ────────────────────────────────────────────────────────────────

export const agentsApi = {
  status: () => request<AgentState[]>('/v1/agents/status'),
}

// ─── SSE streams ───────────────────────────────────────────────────────────

export function streamAgentStatus(
  onEvent: (event: AgentState) => void,
  onError?: (err: Event) => void,
): () => void {
  const es = new EventSource(`${BASE}/v1/agents/status/stream`, {
    withCredentials: true,
  })
  es.onmessage = (e) => {
    try { onEvent(JSON.parse(e.data)) } catch {}
  }
  if (onError) es.onerror = onError
  return () => es.close()
}

export function streamOrchestratorChat(
  message: string,
  onChunk: (text: string) => void,
  onDone?: () => void,
  onError?: (err: string) => void,
): () => void {
  let aborted = false
  const controller = new AbortController()

  fetch(`${BASE}/v1/agents/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message }),
    credentials: 'include',
    signal: controller.signal,
  }).then(async (res) => {
    if (!res.ok) { onError?.('Request failed'); return }
    const reader = res.body?.getReader()
    if (!reader) return
    const decoder = new TextDecoder()
    let buffer = ''
    while (true) {
      if (aborted) break
      const { done, value } = await reader.read()
      if (done) { onDone?.(); break }
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''
      for (const line of lines) {
        if (!line.startsWith('data:')) continue
        const data = line.slice(5).trim()
        if (data === '[DONE]') { onDone?.(); return }
        try {
          const parsed = JSON.parse(data)
          if (parsed.delta?.text) onChunk(parsed.delta.text)
        } catch {}
      }
    }
  }).catch((err) => {
    if (!aborted) onError?.(err.message)
  })

  return () => { aborted = true; controller.abort() }
}
