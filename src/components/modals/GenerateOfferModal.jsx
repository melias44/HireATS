import { useState } from 'react'
import { useApp } from '../../context/AppContext'
import { callAI } from '../../lib/supabase'

export default function GenerateOfferModal({ onClose }) {
  const { candidates, jobs, addOffer } = useApp()
  const [candidateId, setCandidateId] = useState('')
  const [role, setRole] = useState('')
  const [salary, setSalary] = useState('')
  const [startDate, setStartDate] = useState('')
  const [extras, setExtras] = useState('')
  const [offerText, setOfferText] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Only candidates at Offer or Hired stage
  const eligibleCandidates = candidates.filter(c =>
    c.applications?.some(a => a.stage === 'Offer' || a.stage === 'Hired')
  )

  function onCandidateChange(id) {
    setCandidateId(id)
    if (!id) { setRole(''); return }
    const c = candidates.find(x => x.id === id)
    const offerApp = c?.applications?.find(a => a.stage === 'Offer' || a.stage === 'Hired')
    if (offerApp) {
      const job = jobs.find(j => j.id === offerApp.job_id)
      setRole(job?.title || offerApp.role || '')
    }
  }

  async function handleGenerate() {
    if (!candidateId) { setError('Select a candidate first.'); return }
    setError('')
    setAiLoading(true)
    const c = candidates.find(x => x.id === candidateId)
    const name = c ? `${c.fname} ${c.lname}` : '[Candidate]'
    const startStr = startDate
      ? new Date(startDate + 'T12:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
      : '[Start Date]'
    try {
      const text = await callAI(
        `Draft a professional job offer letter for ${name} for the ${role || '[Role]'} position. Details: Base salary: ${salary || '[Salary]'}. Start date: ${startStr}. ${extras ? 'Additional compensation/benefits: ' + extras : ''} The letter should be warm but professional, include the key terms, and ask them to confirm acceptance. Sign off from "The People Team". Keep it to 3-4 paragraphs.`
      )
      setOfferText(text)
    } catch (err) {
      setError('AI generation failed. Make sure the Edge Function is deployed.')
    } finally {
      setAiLoading(false)
    }
  }

  async function handleSave() {
    if (!candidateId) { setError('Select a candidate.'); return }
    setSaving(true)
    setError('')
    try {
      const c = candidates.find(x => x.id === candidateId)
      const job = jobs.find(j => j.title === role)
      await addOffer({
        candidateId,
        candidateName: c ? `${c.fname} ${c.lname}` : '',
        jobId: job?.id || null,
        jobTitle: role,
        salary,
        startDate: startDate || null,
        letterText: offerText,
      })
      onClose()
    } catch (err) {
      setError(err.message)
      setSaving(false)
    }
  }

  return (
    <div className="modal-backdrop open" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal" style={{ width: 620 }}>
        <div className="modal-head">
          <div><div className="modal-title">Generate offer letter</div><div className="modal-sub">AI-drafted, ready to customize</div></div>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          {error && <div style={{ background: 'var(--red-bg)', border: '1px solid #FCA5A5', borderRadius: 'var(--radius)', padding: '8px 12px', fontSize: 13, color: 'var(--red-text)', marginBottom: 14 }}>{error}</div>}
          {eligibleCandidates.length === 0 && (
            <div style={{ background: 'var(--amber-bg)', border: '1px solid #FDE68A', borderRadius: 'var(--radius)', padding: '10px 14px', fontSize: 13, color: 'var(--amber-text)', marginBottom: 16 }}>
              No candidates are at Offer or Hired stage yet. Move a candidate to Offer first.
            </div>
          )}
          <div className="form-grid">
            <div className="form-row">
              <label className="form-label">Candidate</label>
              <select className="form-input" value={candidateId} onChange={e => onCandidateChange(e.target.value)}>
                <option value="">Select candidate…</option>
                {eligibleCandidates.map(c => <option key={c.id} value={c.id}>{c.fname} {c.lname}</option>)}
              </select>
            </div>
            <div className="form-row"><label className="form-label">Role</label><input className="form-input" value={role} onChange={e => setRole(e.target.value)} placeholder="Senior Engineer" /></div>
          </div>
          <div className="form-grid">
            <div className="form-row"><label className="form-label">Base salary</label><input className="form-input" value={salary} onChange={e => setSalary(e.target.value)} placeholder="$135,000" /></div>
            <div className="form-row"><label className="form-label">Start date</label><input className="form-input" type="date" value={startDate} onChange={e => setStartDate(e.target.value)} /></div>
          </div>
          <div className="form-row"><label className="form-label">Additional details (bonus, equity, benefits)</label><textarea className="form-input" value={extras} onChange={e => setExtras(e.target.value)} placeholder="e.g. 10% annual bonus, 0.1% equity, unlimited PTO…" /></div>

          <button className="btn btn-sm" onClick={handleGenerate} disabled={aiLoading} style={{ marginBottom: 12 }}>
            {aiLoading ? <span className="ai-loading"><span className="spinner" />Drafting…</span> : '✨ Generate with AI'}
          </button>

          {offerText && (
            <div className="ai-panel">
              <div className="ai-panel-head"><div className="ai-dot" />&nbsp;AI-drafted offer letter</div>
              <div className="offer-preview">{offerText}</div>
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving || !offerText}>{saving ? 'Saving…' : 'Save offer'}</button>
        </div>
      </div>
    </div>
  )
}
