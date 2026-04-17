'use client'

import { useState, useRef, useCallback } from 'react'
import { ChevronRight, Upload, CheckCircle, Loader2, ArrowRight, ArrowLeft } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useRouter } from 'next/navigation'

const STEPS = [
  { id: 1, label: 'Account' },
  { id: 2, label: 'Resume' },
  { id: 3, label: 'Preferences' },
  { id: 4, label: 'Integrations' },
]

const SENIORITY_OPTIONS = ['Junior', 'Mid', 'Senior', 'Lead', 'Staff', 'Principal']
const CHANNEL_OPTIONS = ['Email (Gmail)', 'LinkedIn', 'Both']

function StepIndicator({ current }: { current: number }) {
  return (
    <div className="flex items-center gap-2 mb-8">
      {STEPS.map((step, i) => (
        <div key={step.id} className="flex items-center gap-2">
          <div className={cn(
            'flex items-center justify-center w-6 h-6 rounded-full text-xs font-medium transition-all duration-200',
            step.id < current ? 'bg-brand-400 text-white' :
            step.id === current ? 'bg-brand-400 text-white shadow-focus' :
            'bg-surface-100 text-surface-400'
          )}>
            {step.id < current ? <CheckCircle size={12} /> : step.id}
          </div>
          <span className={cn(
            'text-xs transition-colors',
            step.id === current ? 'text-surface-700 font-medium' : 'text-surface-400'
          )}>
            {step.label}
          </span>
          {i < STEPS.length - 1 && (
            <div className={cn(
              'w-8 h-px mx-1 transition-colors',
              step.id < current ? 'bg-brand-400' : 'bg-surface-200'
            )} />
          )}
        </div>
      ))}
    </div>
  )
}

// ── Step 1: Account ────────────────────────────────────────────────────────

function StepAccount({ onNext }: { onNext: () => void }) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  return (
    <div className="space-y-4 animate-slide-up">
      <div>
        <h2 className="text-base font-semibold text-surface-800">Create your account</h2>
        <p className="text-xs text-surface-500 mt-1">Your data stays private — no tracking, no ads</p>
      </div>
      <div>
        <label className="text-xs font-medium text-surface-600 block mb-1.5">Full name</label>
        <input className="field text-sm" placeholder="Franck Lebrun" value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div>
        <label className="text-xs font-medium text-surface-600 block mb-1.5">Email</label>
        <input className="field text-sm" type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <div>
        <label className="text-xs font-medium text-surface-600 block mb-1.5">Password</label>
        <input className="field text-sm" type="password" placeholder="8+ characters" value={password} onChange={(e) => setPassword(e.target.value)} />
      </div>
      <button
        onClick={onNext}
        disabled={!name || !email || !password}
        className="btn btn-primary w-full justify-center text-sm py-2.5 gap-2 mt-2"
      >
        Continue <ArrowRight size={14} />
      </button>
    </div>
  )
}

// ── Step 2: Resume ─────────────────────────────────────────────────────────

function StepResume({ onNext }: { onNext: () => void }) {
  const [uploaded, setUploaded] = useState(false)
  const [fileName, setFileName] = useState('')
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const handleFile = useCallback(async (file: File) => {
    setFileName(file.name)
    setUploading(true)
    await new Promise((r) => setTimeout(r, 1000))
    setUploading(false)
    setUploaded(true)
  }, [])

  return (
    <div className="space-y-4 animate-slide-up">
      <div>
        <h2 className="text-base font-semibold text-surface-800">Upload your resume</h2>
        <p className="text-xs text-surface-500 mt-1">AI uses it to score jobs and generate tailored materials</p>
      </div>

      <div
        className={cn(
          'border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-200',
          dragOver ? 'border-brand-400 bg-brand-50' :
          uploaded ? 'border-brand-400 bg-brand-50' :
          'border-surface-200 hover:border-surface-300 hover:bg-surface-50'
        )}
        onClick={() => fileRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f) }}
      >
        <input ref={fileRef} type="file" accept=".pdf,.docx" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />
        {uploading ? (
          <div className="flex flex-col items-center gap-2">
            <Loader2 size={24} className="text-brand-400 animate-spin" />
            <p className="text-xs text-surface-600">Uploading…</p>
          </div>
        ) : uploaded ? (
          <div className="flex flex-col items-center gap-2">
            <CheckCircle size={24} className="text-brand-400" />
            <p className="text-xs font-medium text-surface-700">{fileName}</p>
            <p className="text-2xs text-brand-600">Uploaded</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-surface-100 border border-surface-200 flex items-center justify-center">
              <Upload size={18} className="text-surface-400" />
            </div>
            <p className="text-xs font-medium text-surface-700">Drop your resume here</p>
            <p className="text-2xs text-surface-400">PDF or DOCX · up to 5 MB</p>
          </div>
        )}
      </div>

      <div className="flex gap-2">
        <button onClick={onNext} disabled={!uploaded} className="btn btn-primary flex-1 justify-center text-sm py-2.5 gap-2">
          Continue <ArrowRight size={14} />
        </button>
        <button onClick={onNext} className="btn text-sm py-2.5 text-surface-400">
          Skip for now
        </button>
      </div>
    </div>
  )
}

// ── Step 3: Preferences ────────────────────────────────────────────────────

function StepPreferences({ onNext }: { onNext: () => void }) {
  const [role, setRole] = useState('')
  const [location, setLocation] = useState('')
  const [salary, setSalary] = useState('')
  const [seniority, setSeniority] = useState('Senior')
  const [skills, setSkills] = useState('')

  return (
    <div className="space-y-4 animate-slide-up">
      <div>
        <h2 className="text-base font-semibold text-surface-800">Your search preferences</h2>
        <p className="text-xs text-surface-500 mt-1">Helps the scoring and discovery agents target the right roles</p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium text-surface-600 block mb-1.5">Target role</label>
          <input className="field text-sm" placeholder="e.g. ML Engineer" value={role} onChange={(e) => setRole(e.target.value)} />
        </div>
        <div>
          <label className="text-xs font-medium text-surface-600 block mb-1.5">Location</label>
          <input className="field text-sm" placeholder="Remote / London" value={location} onChange={(e) => setLocation(e.target.value)} />
        </div>
        <div>
          <label className="text-xs font-medium text-surface-600 block mb-1.5">Min salary (USD)</label>
          <input className="field text-sm" type="number" placeholder="120000" value={salary} onChange={(e) => setSalary(e.target.value)} />
        </div>
        <div>
          <label className="text-xs font-medium text-surface-600 block mb-1.5">Seniority</label>
          <select className="field text-sm" value={seniority} onChange={(e) => setSeniority(e.target.value)}>
            {SENIORITY_OPTIONS.map((o) => <option key={o}>{o}</option>)}
          </select>
        </div>
        <div className="col-span-2">
          <label className="text-xs font-medium text-surface-600 block mb-1.5">Key skills (comma separated)</label>
          <input className="field text-sm" placeholder="RAG, LLMs, Python, FastAPI" value={skills} onChange={(e) => setSkills(e.target.value)} />
        </div>
      </div>
      <button onClick={onNext} className="btn btn-primary w-full justify-center text-sm py-2.5 gap-2">
        Continue <ArrowRight size={14} />
      </button>
    </div>
  )
}

// ── Step 4: Integrations ───────────────────────────────────────────────────

function StepIntegrations({ onFinish }: { onFinish: () => void }) {
  const [gmailConnected, setGmailConnected] = useState(false)
  const [linkedinConnected, setLinkedinConnected] = useState(false)
  const [connecting, setConnecting] = useState<string | null>(null)

  async function connect(provider: string) {
    setConnecting(provider)
    await new Promise((r) => setTimeout(r, 1200))
    if (provider === 'gmail') setGmailConnected(true)
    if (provider === 'linkedin') setLinkedinConnected(true)
    setConnecting(null)
  }

  return (
    <div className="space-y-4 animate-slide-up">
      <div>
        <h2 className="text-base font-semibold text-surface-800">Connect integrations</h2>
        <p className="text-xs text-surface-500 mt-1">For email drafts and LinkedIn applications. You can always do this later.</p>
      </div>

      <div className="space-y-3">
        {/* Gmail */}
        <div className={cn(
          'flex items-center gap-3 p-3.5 rounded-lg border transition-colors',
          gmailConnected ? 'border-brand-100 bg-brand-50' : 'border-surface-200 bg-white'
        )}>
          <div className="w-8 h-8 rounded-md bg-surface-100 flex items-center justify-center text-sm flex-shrink-0">
            ✉
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-surface-800">Gmail</p>
            <p className="text-xs text-surface-500">
              {gmailConnected ? 'Connected — drafts only, never auto-sent' : 'Create email drafts for review before sending'}
            </p>
          </div>
          {gmailConnected ? (
            <CheckCircle size={16} className="text-brand-400" />
          ) : (
            <button
              onClick={() => connect('gmail')}
              disabled={!!connecting}
              className="btn text-xs gap-1.5"
            >
              {connecting === 'gmail' ? <Loader2 size={12} className="animate-spin" /> : null}
              Connect
            </button>
          )}
        </div>

        {/* LinkedIn */}
        <div className={cn(
          'flex items-center gap-3 p-3.5 rounded-lg border transition-colors',
          linkedinConnected ? 'border-brand-100 bg-brand-50' : 'border-surface-200 bg-white'
        )}>
          <div className="w-8 h-8 rounded-md bg-purple-bg flex items-center justify-center text-sm flex-shrink-0">
            in
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-surface-800">LinkedIn</p>
            <p className="text-xs text-surface-500">
              {linkedinConnected ? 'Connected — messages sent only after your approval' : 'Send connection notes and apply via LinkedIn'}
            </p>
          </div>
          {linkedinConnected ? (
            <CheckCircle size={16} className="text-brand-400" />
          ) : (
            <button
              onClick={() => connect('linkedin')}
              disabled={!!connecting}
              className="btn text-xs gap-1.5"
            >
              {connecting === 'linkedin' ? <Loader2 size={12} className="animate-spin" /> : null}
              Connect
            </button>
          )}
        </div>
      </div>

      <div className="pt-1">
        <button onClick={onFinish} className="btn btn-primary w-full justify-center text-sm py-2.5 gap-2">
          Go to dashboard <ArrowRight size={14} />
        </button>
        <button onClick={onFinish} className="w-full text-center text-xs text-surface-400 hover:text-surface-600 mt-2 py-1">
          Skip integrations for now
        </button>
      </div>
    </div>
  )
}

// ── Main ───────────────────────────────────────────────────────────────────

export default function OnboardingPage() {
  const [step, setStep] = useState(1)
  const router = useRouter()

  const next = () => setStep((s) => Math.min(s + 1, 4))
  const back = () => setStep((s) => Math.max(s - 1, 1))
  const finish = () => router.push('/discover')

  return (
    <div className="min-h-screen bg-surface-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex items-center gap-2 mb-8 justify-center">
          <div className="w-8 h-8 rounded-lg bg-brand-400 flex items-center justify-center">
            <ChevronRight size={16} className="text-white" strokeWidth={3} />
          </div>
          <span className="text-xl font-semibold text-surface-800 tracking-tight">Daubo</span>
        </div>

        <StepIndicator current={step} />

        <div className="card p-6">
          {step === 1 && <StepAccount onNext={next} />}
          {step === 2 && <StepResume onNext={next} />}
          {step === 3 && <StepPreferences onNext={next} />}
          {step === 4 && <StepIntegrations onFinish={finish} />}

          {step > 1 && (
            <button onClick={back} className="flex items-center gap-1 text-xs text-surface-400 hover:text-surface-600 mt-4 transition-colors">
              <ArrowLeft size={12} /> Back
            </button>
          )}
        </div>

        <p className="text-center text-2xs text-surface-400 mt-4">
          AI drafts everything · You approve before anything is sent
        </p>
      </div>
    </div>
  )
}
