'use client'

import { useState, useRef, useCallback } from 'react'
import { Upload, FileText, CheckCircle, Loader2, Sparkles, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useResumeUpload } from '@/hooks'

const SENIORITY_OPTIONS = ['Junior', 'Mid', 'Senior', 'Lead', 'Staff', 'Principal']

export default function ResumePage() {
  const { upload, uploading, analyzeWithAI, analyzing, analysis } = useResumeUpload()
  const [uploaded, setUploaded] = useState(false)
  const [fileName, setFileName] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const [role, setRole] = useState('AI/ML Engineer')
  const [location, setLocation] = useState('Remote / Europe')
  const [salary, setSalary] = useState('140000')
  const [seniority, setSeniority] = useState('Senior')
  const [skills, setSkills] = useState('RAG, LLMs, Python, FastAPI, MLOps')

  async function handleFile(file: File) {
    if (!file) return
    setFileName(file.name)
    const result = await upload(file)
    if (result.success) setUploaded(true)
  }

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }, [])

  return (
    <div className="p-6 max-w-2xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-surface-800">My resume</h1>
        <p className="text-sm text-surface-500 mt-0.5">Upload your resume to power matching, tailoring, and interview prep</p>
      </div>

      {/* Upload zone */}
      <div
        className={cn(
          'border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-200 mb-6',
          dragOver ? 'border-brand-400 bg-brand-50' : uploaded ? 'border-brand-400 bg-brand-50' : 'border-surface-200 hover:border-surface-300 hover:bg-surface-50'
        )}
        onClick={() => fileRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
      >
        <input
          ref={fileRef}
          type="file"
          accept=".pdf,.docx"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
        />

        {uploading ? (
          <div className="flex flex-col items-center gap-3">
            <Loader2 size={28} className="text-brand-400 animate-spin" />
            <p className="text-sm text-surface-600">Uploading {fileName}…</p>
          </div>
        ) : uploaded ? (
          <div className="flex flex-col items-center gap-3">
            <CheckCircle size={28} className="text-brand-400" />
            <div>
              <p className="text-sm font-medium text-surface-800">{fileName}</p>
              <p className="text-xs text-brand-600 mt-0.5">Uploaded successfully</p>
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); setUploaded(false); setFileName('') }}
              className="text-xs text-surface-400 hover:text-surface-600 flex items-center gap-1"
            >
              <X size={11} /> Replace
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-surface-100 flex items-center justify-center border border-surface-200">
              <Upload size={20} className="text-surface-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-surface-700">Drop your resume here</p>
              <p className="text-xs text-surface-400 mt-1">PDF or DOCX · Up to 5 MB</p>
            </div>
          </div>
        )}
      </div>

      {/* Preferences */}
      <div className="card p-5 mb-5">
        <p className="text-sm font-medium text-surface-800 mb-4">Search preferences</p>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-medium text-surface-500 mb-1.5 block">Target role</label>
            <input className="field text-sm" value={role} onChange={(e) => setRole(e.target.value)} placeholder="e.g. ML Engineer" />
          </div>
          <div>
            <label className="text-xs font-medium text-surface-500 mb-1.5 block">Location</label>
            <input className="field text-sm" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. Remote, London" />
          </div>
          <div>
            <label className="text-xs font-medium text-surface-500 mb-1.5 block">Min salary (USD)</label>
            <input className="field text-sm" value={salary} onChange={(e) => setSalary(e.target.value)} placeholder="e.g. 140000" type="number" />
          </div>
          <div>
            <label className="text-xs font-medium text-surface-500 mb-1.5 block">Seniority</label>
            <select className="field text-sm" value={seniority} onChange={(e) => setSeniority(e.target.value)}>
              {SENIORITY_OPTIONS.map((o) => <option key={o}>{o}</option>)}
            </select>
          </div>
          <div className="col-span-2">
            <label className="text-xs font-medium text-surface-500 mb-1.5 block">Key skills</label>
            <input className="field text-sm" value={skills} onChange={(e) => setSkills(e.target.value)} placeholder="e.g. RAG, LLMs, Python" />
          </div>
        </div>
        <div className="flex gap-2 mt-4 pt-4 border-t border-surface-100">
          <button className="btn btn-primary text-xs">Save preferences</button>
          <button className="btn text-xs">Reset</button>
        </div>
      </div>

      {/* AI Analysis */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-sm font-medium text-surface-800">AI profile analysis</p>
            <p className="text-xs text-surface-500 mt-0.5">Get archetypes, skill gaps, and target companies</p>
          </div>
          <button
            onClick={() => analyzeWithAI(role, skills)}
            disabled={analyzing}
            className="btn btn-primary text-xs gap-1.5"
          >
            {analyzing ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
            {analyzing ? 'Analyzing…' : 'Analyze with AI'}
          </button>
        </div>

        <div className={cn(
          'bg-surface-50 rounded-lg border border-surface-200 p-4 min-h-[100px] text-xs text-surface-700 leading-relaxed whitespace-pre-wrap',
          !analysis && 'flex items-center justify-center text-surface-400'
        )}>
          {analysis || (
            <div className="text-center">
              <FileText size={20} className="mx-auto mb-2 opacity-40" />
              <p>Upload your resume and click Analyze to see your profile breakdown</p>
            </div>
          )}
          {analyzing && <span className="inline-block w-0.5 h-3 bg-brand-400 animate-pulse ml-0.5 align-middle" />}
        </div>
      </div>
    </div>
  )
}
