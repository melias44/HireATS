import { useState } from 'react'
import { useApp } from '../../context/AppContext'

export default function ScheduleInterviewModal({ onClose }) {
  const { candidates, jobs, addInterview } = useApp()
  const [candidateId, setCandidateId] = useState('')
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [type, setType] = useState('Phone screen')
  const [interviewer, setInterviewer] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const activeCandidates = candidates.filter(c =>
    c.applications?.some(a => a.stage !== 'Hired' && a.stage !== 'Rejected')
  )

  async function handleSubmit() {
    if (!candidateId || !date || !time) { setError('Please select a candidate, date, and time.'); return }
    setSaving(true)
    setError('')
    try {
      const c = candidates.find(x => x.id === candidateId)
      const primaryApp = c?.applications?.[0]
      const job = primaryApp ? jobs.find(j => j.id === primaryApp.job_id) : null
      const scheduledAt = new Date(`${date}T${time}:00`).toISOString()
      await addInterview({
        candidateId,
        candidateName: c ? `${c.fname} ${c.lname}` : '',
        jobId: job?.id || null,
        jobTitle: job?.title || '',
        interviewer,
        type,
        scheduledAt,
      })
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
          <div><div className="modal-title">Schedule interview</div></div>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          {error && <div style={{ background: 'var(--red-bg)', border: '1px solid #FCA5A5', borderRadius: 'var(--radius)', padding: '8px 12px', fontSize: 13, color: 'var(--red-text)', marginBottom: 14 }}>{error}</div>}
          <div className="form-row">
            <label className="form-label">Candidate</label>
            <select className="form-input" value={candidateId} onChange={e => setCandidateId(e.target.value)}>
              <option value="">Select candidate…</option>
              {activeCandidates.map(c => <option key={c.id} value={c.id}>{c.fname} {c.lname}</option>)}
            </select>
          </div>
          <div className="form-grid">
            <div className="form-row"><label className="form-label">Date</label><input className="form-input" type="date" value={date} onChange={e => setDate(e.target.value)} /></div>
            <div className="form-row"><label className="form-label">Time</label><input className="form-input" type="time" value={time} onChange={e => setTime(e.target.value)} /></div>
          </div>
          <div className="form-grid">
            <div className="form-row">
              <label className="form-label">Interview type</label>
              <select className="form-input" value={type} onChange={e => setType(e.target.value)}>
                {['Phone screen', 'Video interview', 'Technical', 'On-site', 'Final round'].map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div className="form-row"><label className="form-label">Interviewer</label><input className="form-input" value={interviewer} onChange={e => setInterviewer(e.target.value)} placeholder="Name or email" /></div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSubmit} disabled={saving}>{saving ? 'Saving…' : 'Schedule'}</button>
        </div>
      </div>
    </div>
  )
}
