import { useState } from 'react'
import { useApp } from '../../context/AppContext'
import { supabase } from '../../lib/supabase'

const DEPARTMENTS = ['Edit','Editorial Design','Sales','Corporate','Sales Planning','Brand Strategy','HR','Marketing','Social','PR','Video','Affiliate','Branded Design','Engineering','Branded Content','Production','Account Management','Legal','Finance','IT','Experiential','NYLON Membership']
const BRANDS = ['BDG','Bustle','W','Elite Daily','Scary Mommy','Inverse','Nylon','TZR']

function formatMoney(val) {
  if (!val) return ''
  const stripped = String(val).replace(/^\$/, '')
  return stripped ? '$' + stripped : ''
}

export default function HireConfirmModal({ app, candidate, job, onCancel, onConfirm }) {
  const { offers } = useApp()

  // Pre-fill from existing data
  const linkedOffer = offers.find(o => o.candidate_id === candidate.id && o.job_id === app.job_id)

  const [form, setForm] = useState({
    name:           `${candidate.fname} ${candidate.lname}`,
    email:          candidate.email || '',
    jobTitle:       job?.title || '',
    department:     '',
    brand:          '',
    manager:        '',
    startDate:      linkedOffer?.start_date || '',
    location:       candidate.location || '',
    salary:         formatMoney(linkedOffer?.salary || ''),
    bonus:          '',
    commission:     '',
    employmentType: 'Full Time',
    homeState:      app.home_state || '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')

  function set(field, val) {
    setForm(prev => ({ ...prev, [field]: val }))
  }

  async function handleConfirm() {
    if (!form.department) { setError('Department is required.'); return }
    if (!form.brand) { setError('Brand is required.'); return }
    if (!form.manager.trim()) { setError('Manager is required.'); return }
    setSaving(true)
    setError('')
    try {
      const { error: fnErr } = await supabase.functions.invoke('sync-hired', { body: { ...form, candidateId: candidate.id } })
      if (fnErr) throw new Error(fnErr.message)
      await onConfirm()
    } catch (err) {
      setError(`Sheet sync failed: ${err.message}`)
      setSaving(false)
    }
  }

  async function handleSkipAndConfirm() {
    setSaving(true)
    await onConfirm()
    setSaving(false)
  }

  return (
    <div
      className="modal-backdrop open"
      style={{ zIndex: 1200 }}
      onClick={e => { if (e.target === e.currentTarget) onCancel() }}
    >
      <div className="modal" style={{ width: 600 }}>
        <div className="modal-head">
          <div>
            <div className="modal-title">Confirm hire — {form.name}</div>
            <div className="modal-sub">Review details before finalizing. This will update the New Hires sheet.</div>
          </div>
          <button className="modal-close" onClick={onCancel}>×</button>
        </div>

        <div className="modal-body">
          {error && (
            <div style={{ background: 'var(--red-bg)', border: '1px solid #FCA5A5', borderRadius: 'var(--radius)', padding: '8px 12px', fontSize: 13, color: 'var(--red-text)', marginBottom: 14 }}>
              {error}
            </div>
          )}

          <div className="form-grid">
            <div className="form-row">
              <label className="form-label">Employee name</label>
              <input className="form-input" value={form.name} onChange={e => set('name', e.target.value)} />
            </div>
            <div className="form-row">
              <label className="form-label">Email</label>
              <input className="form-input" type="email" value={form.email} onChange={e => set('email', e.target.value)} />
            </div>
          </div>

          <div className="form-grid">
            <div className="form-row">
              <label className="form-label">Job title</label>
              <input className="form-input" value={form.jobTitle} onChange={e => set('jobTitle', e.target.value)} />
            </div>
            <div className="form-row">
              <label className="form-label">Manager *</label>
              <input
                className="form-input"
                placeholder="e.g. Jane Smith"
                value={form.manager}
                onChange={e => set('manager', e.target.value)}
                style={!form.manager.trim() && error ? { borderColor: '#EF4444' } : {}}
              />
            </div>
          </div>

          <div className="form-grid">
            <div className="form-row">
              <label className="form-label">Department *</label>
              <select className="form-input" value={form.department} onChange={e => set('department', e.target.value)} style={!form.department && error ? { borderColor: '#EF4444' } : {}}>
                <option value="">Select department…</option>
                {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div className="form-row">
              <label className="form-label">Brand *</label>
              <select className="form-input" value={form.brand} onChange={e => set('brand', e.target.value)} style={!form.brand && error ? { borderColor: '#EF4444' } : {}}>
                <option value="">Select brand…</option>
                {BRANDS.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
          </div>

          <div className="form-grid">
            <div className="form-row">
              <label className="form-label">Start date</label>
              <input className="form-input" type="date" value={form.startDate} onChange={e => set('startDate', e.target.value)} />
            </div>
            <div className="form-row">
              <label className="form-label">Location</label>
              <input className="form-input" placeholder="e.g. New York, NY" value={form.location} onChange={e => set('location', e.target.value)} />
            </div>
          </div>

          <div className="form-grid">
            <div className="form-row">
              <label className="form-label">Salary</label>
              <input className="form-input" placeholder="e.g. $95,000" value={form.salary} onChange={e => set('salary', formatMoney(e.target.value))} />
            </div>
            <div className="form-row">
              <label className="form-label">Annual bonus</label>
              <input className="form-input" placeholder="e.g. $5,000 or N/A" value={form.bonus} onChange={e => set('bonus', formatMoney(e.target.value))} />
            </div>
          </div>

          <div className="form-grid">
            <div className="form-row">
              <label className="form-label">Commission</label>
              <input className="form-input" placeholder="e.g. $10,000 or N/A" value={form.commission} onChange={e => set('commission', formatMoney(e.target.value))} />
            </div>
            <div className="form-row">
              <label className="form-label">Employment type</label>
              <select className="form-input" value={form.employmentType} onChange={e => set('employmentType', e.target.value)}>
                {['Full Time', 'Part Time', 'Temp Part Time', 'Temp Full Time', 'Intern'].map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
          </div>

          <div className="form-grid">
            <div className="form-row">
              <label className="form-label">Home state (tax)</label>
              <input className="form-input" placeholder="e.g. New York" value={form.homeState} onChange={e => set('homeState', e.target.value)} />
            </div>
            <div className="form-row" />
          </div>

          <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '10px 14px', fontSize: 13, color: 'var(--text-3)', marginTop: 4 }}>
            Confirming will move this candidate to <strong>Hired</strong>, close the job posting, and add a row to the <strong>HireME — New Hires</strong> Google Sheet.
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn" onClick={onCancel} disabled={saving}>Cancel</button>
          {error && (
            <button className="btn" onClick={handleSkipAndConfirm} disabled={saving} title="Confirm the hire without syncing the sheet">
              Skip sheet & confirm
            </button>
          )}
          <button className="btn btn-primary" onClick={handleConfirm} disabled={saving}>
            {saving ? 'Saving…' : '✓ Confirm hire'}
          </button>
        </div>
      </div>
    </div>
  )
}
