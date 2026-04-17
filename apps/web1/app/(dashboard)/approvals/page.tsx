'use client'

import { useState } from 'react'
import { Check, X, Edit3, Mail, Linkedin, Loader2, ShieldCheck, AlertCircle } from 'lucide-react'
import { cn, channelLabel, relativeTime } from '@/lib/utils'
import { useApprovalStore } from '@/stores'
import { useApprovals } from '@/hooks'
import { approvalsApi } from '@/lib/api'
import type { Approval } from '@/types'

function ChannelIcon({ channel }: { channel: Approval['channel'] }) {
  if (channel === 'email') return <Mail size={12} />
  if (channel === 'linkedin') return <Linkedin size={12} />
  return null
}

function ApprovalCard({ approval }: { approval: Approval }) {
  const { removeApproval, updateApproval } = useApprovalStore()
  const [editing, setEditing] = useState(false)
  const [editedBody, setEditedBody] = useState(approval.draft_body)
  const [approving, setApproving] = useState(false)
  const [rejecting, setRejecting] = useState(false)
  const [done, setDone] = useState<'approved' | 'rejected' | null>(null)

  async function handleApprove() {
    setApproving(true)
    try {
      await approvalsApi.approve(approval.id, editing ? editedBody : undefined)
      setDone('approved')
      setTimeout(() => removeApproval(approval.id), 1200)
    } catch {
      setApproving(false)
    }
  }

  async function handleReject() {
    setRejecting(true)
    try {
      await approvalsApi.reject(approval.id)
      setDone('rejected')
      setTimeout(() => removeApproval(approval.id), 800)
    } catch {
      setRejecting(false)
    }
  }

  if (done) {
    return (
      <div className={cn(
        'card p-4 flex items-center gap-3 animate-fade-in transition-all',
        done === 'approved' ? 'bg-brand-50 border-brand-100' : 'bg-danger-bg border-danger-border'
      )}>
        {done === 'approved'
          ? <Check size={16} className="text-brand-600" />
          : <X size={16} className="text-danger-text" />
        }
        <p className="text-sm font-medium text-surface-700">
          {done === 'approved' ? `Application to ${approval.application.job.company} queued for send` : 'Rejected'}
        </p>
      </div>
    )
  }

  return (
    <div className="card animate-fade-in">
      <div className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-md bg-surface-100 flex items-center justify-center text-xs font-semibold text-surface-500 border border-surface-200 flex-shrink-0">
              {approval.application.job.company.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <p className="text-sm font-medium text-surface-800">{approval.application.job.company}</p>
              <p className="text-xs text-surface-500">{approval.application.job.title}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={cn(
              'badge text-xs gap-1',
              approval.channel === 'email' ? 'ch-email' : 'ch-linkedin'
            )}>
              <ChannelIcon channel={approval.channel} />
              {channelLabel(approval.channel)}
            </span>
            <span className="text-2xs text-surface-400">{relativeTime(approval.created_at)}</span>
          </div>
        </div>

        {/* Subject */}
        {approval.subject && (
          <div className="mb-2">
            <span className="text-2xs text-surface-400 uppercase tracking-wider font-medium">Subject </span>
            <span className="text-xs text-surface-600">{approval.subject}</span>
          </div>
        )}

        {/* Draft preview / edit */}
        <div className="bg-surface-50 rounded-lg border border-surface-200 mb-3 overflow-hidden">
          {editing ? (
            <textarea
              value={editedBody}
              onChange={(e) => setEditedBody(e.target.value)}
              className="w-full p-3 text-xs text-surface-700 bg-transparent resize-none focus:outline-none leading-relaxed min-h-[140px]"
            />
          ) : (
            <div className="p-3 relative">
              <p className="text-xs text-surface-600 leading-relaxed line-clamp-5 whitespace-pre-wrap">
                {approval.draft_body}
              </p>
              <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-surface-50 to-transparent" />
            </div>
          )}
        </div>

        {/* HITL notice */}
        <div className="flex items-center gap-1.5 mb-3 px-1">
          <ShieldCheck size={12} className="text-brand-400" />
          <p className="text-2xs text-surface-400">
            Nothing is sent until you approve. You can edit before approving.
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleApprove}
            disabled={approving || rejecting}
            className="btn btn-primary text-xs gap-1.5"
          >
            {approving ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
            {approving ? 'Sending…' : 'Approve & send'}
          </button>
          <button
            onClick={() => setEditing((x) => !x)}
            className={cn('btn text-xs gap-1.5', editing && 'bg-surface-100 border-surface-300')}
          >
            <Edit3 size={12} />
            {editing ? 'Done editing' : 'Edit draft'}
          </button>
          <button
            onClick={handleReject}
            disabled={approving || rejecting}
            className="btn btn-danger text-xs gap-1.5 ml-auto"
          >
            {rejecting ? <Loader2 size={12} className="animate-spin" /> : <X size={12} />}
            Reject
          </button>
        </div>
      </div>
    </div>
  )
}

function ApprovalSkeleton() {
  return (
    <div className="card p-4 space-y-3">
      <div className="flex gap-3">
        <div className="skeleton w-9 h-9 rounded-md flex-shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="skeleton h-3.5 w-32 rounded" />
          <div className="skeleton h-3 w-24 rounded" />
        </div>
        <div className="skeleton h-5 w-16 rounded-full" />
      </div>
      <div className="skeleton h-28 rounded-lg" />
      <div className="flex gap-2">
        <div className="skeleton h-7 w-32 rounded-md" />
        <div className="skeleton h-7 w-20 rounded-md" />
        <div className="skeleton h-7 w-16 rounded-md ml-auto" />
      </div>
    </div>
  )
}

export default function ApprovalsPage() {
  const { approvals, loading } = useApprovalStore()
  useApprovals()

  const pending = approvals.filter((a) => a.status === 'pending')

  return (
    <div className="p-6 max-w-2xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-surface-800">Pending approvals</h1>
        <p className="text-sm text-surface-500 mt-0.5">Review AI-drafted applications before they are sent</p>
      </div>

      {/* Notice */}
      {pending.length > 0 && (
        <div className="flex items-start gap-2.5 p-3.5 bg-warning-bg border border-warning-border rounded-lg mb-5">
          <AlertCircle size={15} className="text-warning-text mt-0.5 flex-shrink-0" />
          <p className="text-sm text-warning-text">
            <span className="font-medium">{pending.length} application{pending.length !== 1 ? 's' : ''} ready for review.</span>{' '}
            AI drafted each one — nothing is sent until you approve.
          </p>
        </div>
      )}

      {/* List */}
      <div className="space-y-3">
        {loading
          ? Array.from({ length: 3 }).map((_, i) => <ApprovalSkeleton key={i} />)
          : pending.length === 0
          ? (
            <div className="text-center py-16">
              <ShieldCheck size={28} className="mx-auto mb-3 text-brand-400 opacity-60" />
              <p className="text-sm font-medium text-surface-500">All caught up</p>
              <p className="text-xs text-surface-400 mt-1">No pending approvals right now</p>
            </div>
          )
          : pending.map((a) => <ApprovalCard key={a.id} approval={a} />)
        }
      </div>
    </div>
  )
}
