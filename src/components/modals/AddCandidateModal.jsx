import { useState } from 'react'
import { useApp } from '../../context/AppContext'

export default function AddCandidateModal({ onClose }) {
  const { activeJobs, addCandidate } = useApp()
  const [fname, setFname] = useState('')
  const [lname, setLname] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('')
  const [source, setSource] = useState('LinkedIn')
  const [noteText, setNoteText] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit() {
    if (!fname || !lname || !role) { setError('Please fill in first name, last name, and role.'); return }
    setSaving(true)
    setError('')
    try {
      await addCandidate({ fname, lname, email, source, role, noteText })
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
          <div><div className="modal-title">Add candidate</div><div className="modal-sub">Manually add a new applicant</div></div>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          {error && <div style={{ background: 'var(--red-bg)', border: '1px solid #FCA5A5', borderRadius: 'var(--radius)', padding: '8px 12px', fontSize: 13, color: 'var(--red-text)', marginBottom: 14 }}>{error}</div>}
          <div className="form-grid">
            <div className="form-row"><label className="form-label">First name</label><input className="form-input" value={fname} onChange={e => setFname(e.target.value)} placeholder="Jordan" /></div>
            <div className="form-row"><label className="form-label">Last name</label><input className="form-input" value={lname} onChange={e => setLname(e.target.value)} placeholder="Lee" /></div>
          </div>
          <div className="form-row"><label className="form-label">Email</label><input className="form-input" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="jordan@email.com" /></div>
          <div className="form-grid">
            <div className="form-row">
              <label className="form-label">Role applying for</label>
              <select className="form-input" value={role} onChange={e => setRole(e.target.value)}>
                <option value="">Select role…</option>
                {activeJobs.map(j => <option key={j.id} value={j.title}>{j.title}</option>)}
              </select>
            </div>
            <div className="form-row">
              <label className="form-label">Source</label>
              <select className="form-input" value={source} onChange={e => setSource(e.target.value)}>
                {['LinkedIn', 'Indeed', 'Referral', 'Company website', 'Other'].map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div className="form-row"><label className="form-label">Notes</label><textarea className="form-input" value={noteText} onChange={e => setNoteText(e.target.value)} placeholder="Any initial notes…" /></div>
        </div>
        <div className="modal-footer">
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSubmit} disabled={saving}>{saving ? 'Saving…' : 'Add candidate'}</button>
        </div>
      </div>
    </div>
  )
}
