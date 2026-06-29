import { useState } from 'react'
import { useApp } from '../../context/AppContext'

export default function AddApplicationModal({ candidateId, onClose }) {
  const { candidates, activeJobs, addApplication } = useApp()
  const c = candidates.find(x => x.id === candidateId)
  const existingJobIds = c?.applications?.map(a => a.job_id) || []
  const available = activeJobs.filter(j => !existingJobIds.includes(j.id))
  const [jobId, setJobId] = useState(available[0]?.id || '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit() {
    if (!jobId) { setError('Select a role.'); return }
    setSaving(true)
    try {
      await addApplication(candidateId, jobId)
      onClose()
    } catch (err) {
      setError(err.message)
      setSaving(false)
    }
  }

  return (
    <div className="modal-backdrop open" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal" style={{ width: 420 }}>
        <div className="modal-head">
          <div>
            <div className="modal-title">Add role application</div>
            <div className="modal-sub">{c ? `${c.fname} ${c.lname}` : ''}</div>
          </div>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          {error && <div style={{ background: 'var(--red-bg)', border: '1px solid #FCA5A5', borderRadius: 'var(--radius)', padding: '8px 12px', fontSize: 13, color: 'var(--red-text)', marginBottom: 14 }}>{error}</div>}
          {available.length === 0 ? (
            <div style={{ fontSize: 13, color: 'var(--text-3)' }}>This candidate is already applied to all active roles.</div>
          ) : (
            <div className="form-row">
              <label className="form-label">Role</label>
              <select className="form-input" value={jobId} onChange={e => setJobId(e.target.value)}>
                {available.map(j => <option key={j.id} value={j.id}>{j.title}</option>)}
              </select>
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn" onClick={onClose}>Cancel</button>
          {available.length > 0 && (
            <button className="btn btn-primary" onClick={handleSubmit} disabled={saving}>{saving ? 'Saving…' : 'Add application'}</button>
          )}
        </div>
      </div>
    </div>
  )
}
