import { useState } from 'react'
import { useApp } from '../../context/AppContext'
import { callAI } from '../../lib/supabase'
import RichTextEditor, { plainToHtml } from '../RichTextEditor'

export default function EditJobModal({ job, onClose }) {
  const { updateJob, team } = useApp()
  const [title, setTitle] = useState(job.title || '')
  const [dept, setDept] = useState(job.dept || 'Engineering')
  const [location, setLocation] = useState(job.location || '')
  const [empType, setEmpType] = useState(job.employment_type || 'Full-time')
  const [salary, setSalary] = useState(job.salary || '')
  const [description, setDescription] = useState(job.description || '')
  const [hiringManagerId, setHiringManagerId] = useState(job.hiring_manager_id || '')
  const [saving, setSaving] = useState(false)
  const [aiLoading, setAiLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleGenerate() {
    if (!title) { setError('Enter a job title first.'); return }
    setError('')
    setAiLoading(true)
    try {
      const text = await callAI(
        `Write a concise, compelling job description for a ${title} role in the ${dept} department${salary ? ' with salary range ' + salary : ''}. Include: 2-3 sentence overview, 4-5 key responsibilities (bullet points), 4-5 requirements (bullet points). Keep it professional but human. No fluff.`
      )
      setDescription(plainToHtml(text))
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
      await updateJob(job.id, {
        title,
        dept,
        location: location || 'Remote',
        employment_type: empType,
        salary: salary || 'TBD',
        description,
        hiring_manager_id: hiringManagerId || null,
      })
      onClose()
    } catch (err) {
      setError(err.message)
      setSaving(false)
    }
  }

  return (
    <div className="modal-backdrop open" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal" style={{ width: 640 }}>
        <div className="modal-head">
          <div>
            <div className="modal-title">Edit job posting</div>
            <div className="modal-sub">{job.title} — changes take effect immediately</div>
          </div>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          {error && (
            <div style={{ background: 'var(--red-bg)', border: '1px solid #FCA5A5', borderRadius: 'var(--radius)', padding: '8px 12px', fontSize: 13, color: 'var(--red-text)', marginBottom: 14 }}>
              {error}
            </div>
          )}

          <div className="form-row">
            <label className="form-label">Job title</label>
            <input className="form-input" value={title} onChange={e => setTitle(e.target.value)} placeholder="Senior Software Engineer" />
          </div>

          <div className="form-grid">
            <div className="form-row">
              <label className="form-label">Department</label>
              <select className="form-input" value={dept} onChange={e => setDept(e.target.value)}>
                {['Account Management', 'Brand Strategy', 'BDG', 'Bustle', 'Commerce', 'Design', 'Elite Daily', 'Engineering', 'Experiential', 'Fatherly', 'Finance', 'HR', 'Inverse', 'Legal', 'NYLON', 'Sales', 'Scary Mommy', 'Social Media', 'Talent', 'The Zoe Report', 'W'].map(d => <option key={d}>{d}</option>)}
              </select>
            </div>
            <div className="form-row">
              <label className="form-label">Location</label>
              <input className="form-input" value={location} onChange={e => setLocation(e.target.value)} placeholder="Remote / New York, NY" />
            </div>
          </div>

          <div className="form-grid">
            <div className="form-row">
              <label className="form-label">Employment type</label>
              <select className="form-input" value={empType} onChange={e => setEmpType(e.target.value)}>
                {['Full-time', 'Part-time', 'Contract'].map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div className="form-row">
              <label className="form-label">Salary range</label>
              <input className="form-input" value={salary} onChange={e => setSalary(e.target.value)} placeholder="$120,000 – $150,000" />
            </div>
          </div>

          <div className="form-row">
            <label className="form-label">Hiring manager <span style={{ color: 'var(--text-3)', fontWeight: 400 }}>(optional)</span></label>
            <select className="form-input" value={hiringManagerId} onChange={e => setHiringManagerId(e.target.value)}>
              <option value="">— None assigned —</option>
              {team.map(m => (
                <option key={m.id} value={m.id}>{m.full_name || m.email}</option>
              ))}
            </select>
          </div>

          <div className="form-row">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <label className="form-label" style={{ margin: 0 }}>Job description</label>
              <button className="btn btn-sm" onClick={handleGenerate} disabled={aiLoading}>
                {aiLoading ? <span className="ai-loading"><span className="spinner" />Generating…</span> : '✨ Regenerate with AI'}
              </button>
            </div>
            <RichTextEditor
              value={description}
              onChange={setDescription}
              placeholder="Describe the role, responsibilities, and requirements…"
            />
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSubmit} disabled={saving}>
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </div>
    </div>
  )
}
