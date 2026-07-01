import { useState } from 'react'
import { useApp } from '../../context/AppContext'
import { callAI } from '../../lib/supabase'

export default function AddJobModal({ onClose, onCreated }) {
  const { addJob, team } = useApp()
  const [title, setTitle] = useState('')
  const [dept, setDept] = useState('Engineering')
  const [location, setLocation] = useState('')
  const [empType, setEmpType] = useState('Full-time')
  const [salary, setSalary] = useState('')
  const [description, setDescription] = useState('')
  const [hiringManagerId, setHiringManagerId] = useState('')
  const [saving, setSaving] = useState(false)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiText, setAiText] = useState('')
  const [error, setError] = useState('')

  // Show all team members as potential hiring managers
  const hiringManagers = team

  async function handleGenerate() {
    if (!title) { setError('Enter a job title first.'); return }
    setError('')
    setAiLoading(true)
    try {
      const text = await callAI(
        `Write a concise, compelling job description for a ${title} role in the ${dept} department${salary ? ' with salary range ' + salary : ''}. Include: 2-3 sentence overview, 4-5 key responsibilities (bullet points), 4-5 requirements (bullet points). Keep it professional but human. No fluff.`
      )
      setAiText(text)
      setDescription(text)
    } catch (err) {
      setError('AI generation failed — make sure the Edge Function is deployed.')
    } finally {
      setAiLoading(false)
    }
  }

  async function handleSubmit() {
    if (!title) { setError('Please enter a job title.'); return }
    setSaving(true)
    setError('')
    try {
      const job = await addJob({ title, dept, location: location || 'Remote', employment_type: empType, salary: salary || 'TBD', description, hiring_manager_id: hiringManagerId || null })
      onCreated?.(job.id)
      onClose()
    } catch (err) {
      setError(err.message)
      setSaving(false)
    }
  }

  return (
    <div className="modal-backdrop open" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal">
        <div className="modal-head">
          <div><div className="modal-title">New job posting</div><div className="modal-sub">Create a new open role</div></div>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          {error && <div style={{ background: 'var(--red-bg)', border: '1px solid #FCA5A5', borderRadius: 'var(--radius)', padding: '8px 12px', fontSize: 13, color: 'var(--red-text)', marginBottom: 14 }}>{error}</div>}
          <div className="form-row"><label className="form-label">Job title</label><input className="form-input" value={title} onChange={e => setTitle(e.target.value)} placeholder="Senior Software Engineer" /></div>
          <div className="form-grid">
            <div className="form-row">
              <label className="form-label">Department</label>
              <select className="form-input" value={dept} onChange={e => setDept(e.target.value)}>
                {['Account Management', 'Brand Strategy', 'BDG', 'Bustle', 'Commerce', 'Design', 'Elite Daily', 'Engineering', 'Experiential', 'Fatherly', 'Finance', 'HR', 'Inverse', 'Legal', 'NYLON', 'Sales', 'Scary Mommy', 'Social Media', 'Talent', 'The Zoe Report', 'W'].map(d => <option key={d}>{d}</option>)}
              </select>
            </div>
            <div className="form-row"><label className="form-label">Location</label><input className="form-input" value={location} onChange={e => setLocation(e.target.value)} placeholder="Remote / New York, NY" /></div>
          </div>
          <div className="form-grid">
            <div className="form-row">
              <label className="form-label">Employment type</label>
              <select className="form-input" value={empType} onChange={e => setEmpType(e.target.value)}>
                {['Full-time', 'Part-time', 'Contract'].map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div className="form-row"><label className="form-label">Salary range</label><input className="form-input" value={salary} onChange={e => setSalary(e.target.value)} placeholder="$120,000 – $150,000" /></div>
          </div>
          <div className="form-row">
            <label className="form-label">Hiring manager <span style={{ color: 'var(--text-3)', fontWeight: 400 }}>(optional)</span></label>
            <select className="form-input" value={hiringManagerId} onChange={e => setHiringManagerId(e.target.value)}>
              <option value="">— None assigned —</option>
              {hiringManagers.map(m => (
                <option key={m.id} value={m.id}>{m.full_name || m.email}</option>
              ))}
            </select>
          </div>
          <div className="form-row"><label className="form-label">Job description</label><textarea className="form-input" style={{ minHeight: 100 }} value={description} onChange={e => setDescription(e.target.value)} placeholder="Describe the role, responsibilities, and requirements…" /></div>

          {aiText && (
            <div className="ai-panel">
              <div className="ai-panel-head"><div className="ai-dot" />&nbsp;AI-generated description</div>
              <div className="ai-output">{aiText}</div>
            </div>
          )}
          <button className="btn btn-sm" onClick={handleGenerate} disabled={aiLoading} style={{ marginBottom: 4 }}>
            {aiLoading ? <span className="ai-loading"><span className="spinner" />Generating…</span> : '✨ Generate description with AI'}
          </button>
        </div>
        <div className="modal-footer">
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSubmit} disabled={saving}>{saving ? 'Saving…' : 'Post job'}</button>
        </div>
      </div>
    </div>
  )
}
