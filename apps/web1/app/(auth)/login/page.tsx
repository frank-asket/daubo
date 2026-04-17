'use client'

import { useState } from 'react'
import { ChevronRight, Mail, Github, Loader2, Eye, EyeOff } from 'lucide-react'
import { cn } from '@/lib/utils'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const [oauthLoading, setOauthLoading] = useState<string | null>(null)

  async function handleEmailLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    // TODO: call signIn('credentials', { email, password, callbackUrl: '/discover' })
    await new Promise((r) => setTimeout(r, 1000))
    setLoading(false)
  }

  async function handleOAuth(provider: string) {
    setOauthLoading(provider)
    // TODO: call signIn(provider, { callbackUrl: '/discover' })
    await new Promise((r) => setTimeout(r, 800))
    setOauthLoading(null)
  }

  return (
    <div className="min-h-screen bg-surface-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex items-center gap-2 mb-8 justify-center">
          <div className="w-8 h-8 rounded-lg bg-brand-400 flex items-center justify-center">
            <ChevronRight size={16} className="text-white" strokeWidth={3} />
          </div>
          <span className="text-xl font-semibold text-surface-800 tracking-tight">Daubo</span>
        </div>

        <div className="card p-6">
          <div className="mb-5">
            <h1 className="text-base font-semibold text-surface-800">Sign in</h1>
            <p className="text-xs text-surface-500 mt-0.5">Continue your AI-powered job search</p>
          </div>

          {/* OAuth */}
          <div className="space-y-2 mb-5">
            <button
              onClick={() => handleOAuth('google')}
              disabled={!!oauthLoading}
              className="btn w-full justify-center gap-2 text-sm py-2.5"
            >
              {oauthLoading === 'google'
                ? <Loader2 size={14} className="animate-spin" />
                : <Mail size={14} />
              }
              Continue with Google
            </button>
            <button
              onClick={() => handleOAuth('github')}
              disabled={!!oauthLoading}
              className="btn w-full justify-center gap-2 text-sm py-2.5"
            >
              {oauthLoading === 'github'
                ? <Loader2 size={14} className="animate-spin" />
                : <Github size={14} />
              }
              Continue with GitHub
            </button>
          </div>

          <div className="relative mb-5">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-surface-200" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-white px-2 text-2xs text-surface-400 uppercase tracking-wider">or</span>
            </div>
          </div>

          {/* Email form */}
          <form onSubmit={handleEmailLogin} className="space-y-3">
            <div>
              <label className="text-xs font-medium text-surface-600 block mb-1.5">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="field text-sm"
                placeholder="you@example.com"
                required
              />
            </div>
            <div>
              <label className="text-xs font-medium text-surface-600 block mb-1.5">Password</label>
              <div className="relative">
                <input
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="field text-sm pr-9"
                  placeholder="••••••••"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPw((x) => !x)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-surface-400 hover:text-surface-600"
                >
                  {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>
            <button
              type="submit"
              disabled={loading || !email || !password}
              className="btn btn-primary w-full justify-center text-sm py-2.5 gap-2"
            >
              {loading && <Loader2 size={14} className="animate-spin" />}
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          <p className="text-center text-xs text-surface-400 mt-4">
            No account?{' '}
            <a href="/onboarding" className="text-brand-600 hover:underline">
              Get started
            </a>
          </p>
        </div>

        <p className="text-center text-2xs text-surface-400 mt-4">
          AI drafts · You approve · Nothing sent without your go-ahead
        </p>
      </div>
    </div>
  )
}
