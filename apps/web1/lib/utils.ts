import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { formatDistanceToNow, format } from 'date-fns'
import type { ApplicationStatus, Channel } from '@/types'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function fitClass(score: number) {
  if (score >= 4.0) return 'fit-high'
  if (score >= 3.0) return 'fit-mid'
  return 'fit-low'
}

export function fitLabel(score: number) {
  if (score >= 4.5) return 'Excellent fit'
  if (score >= 4.0) return 'Strong fit'
  if (score >= 3.0) return 'Good fit'
  return 'Weak fit'
}

export function statusBadgeClass(status: ApplicationStatus) {
  const map: Record<ApplicationStatus, string> = {
    saved:     'badge-saved',
    pending:   'badge-pending',
    applied:   'badge-applied',
    interview: 'badge-interview',
    offer:     'badge-offer',
    rejected:  'badge-rejected',
  }
  return map[status] ?? 'badge-saved'
}

export function channelBadgeClass(channel: Channel) {
  const map: Record<Channel, string> = {
    email:        'ch-email',
    linkedin:     'ch-linkedin',
    company_site: 'ch-site',
  }
  return map[channel]
}

export function channelLabel(channel: Channel) {
  const map: Record<Channel, string> = {
    email:        'Email',
    linkedin:     'LinkedIn',
    company_site: 'Company site',
  }
  return map[channel]
}

export function relativeTime(date: string) {
  try { return formatDistanceToNow(new Date(date), { addSuffix: true }) }
  catch { return '—' }
}

export function shortDate(date: string) {
  try { return format(new Date(date), 'MMM d') }
  catch { return '—' }
}

export function generateIdempotencyKey(): string {
  return `dab-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

export function initials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('')
}

export function scoreBarWidth(score: number, max = 5): number {
  return Math.round((Math.min(score, max) / max) * 100)
}
