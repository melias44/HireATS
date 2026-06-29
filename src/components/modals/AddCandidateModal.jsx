import { useState, useRef } from 'react'
import { useApp } from '../../context/AppContext'
import { supabase } from '../../lib/supabase'

export default function AddCandidateModal({ onClose }) {
  const { activeJobs, addCandidate } = useApp()
  const [fname, setFname] = useState('')
  const [lname, setLname] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [linkedin, setLinkedin] = useState('')
  const [location, setLocation] = useState('')
  const [experience, setExperience] = useState('')
  const [role, setRole] = useState('')
  const [source, setSource] = useState('LinkedIn')
  const [noteText, setNoteText] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Resume upload + parsing
  const [resumeFile, setResumeFile] = useState(null)
  const [parsing, setParsing] = useState(false)
  const [parseStatus, setParseStatus] = useState('') // success or error message
  const fileInputRef = useRef()

  async function handleResumeSelect(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setResumeFile(file)
    setParseStatus('')
    setParsing(true)
    try {
      const arrayBuffer = await file.arrayBuffer()
      const uint8 = new Uint8Array(arrayBuffer)
      let binary = ''
      uint8.forEach(b => (binary += String.fromCharCode(b)))
      const fileBase64 = btoa(binary)

      const { data, error: fnErr } = await supabase.functions.invoke('parse-resume', {
        body: { fileBase64, fileType: file.type },
      })
      if (fnErr) throw fnErr

      // Only auto-fill fields that are still empty
      if (data.fname && !fname) setFname(data.fname)
      if (data.lname && !lname) setLname(data.lname)
      if (data.email && !email) setEmail(data.email)
      if (data.phone && !phone) setPhone(data.phone)
      if (data.linkedin && !linkedin) setLinkedin(data.linkedin)
      if (data.location && !location) setLocation(data.location)
      if (data.experience && !experience) setExperience(data.experience)
      if (data.source) setSource(data.source)

      setParseStatus('✓ Resume parsed — review the fields below and edit if needed.')
    } catch (err) {
      setParseStatus(`Parse error: ${err?.message || String(err)}`)
    } finally {
      setParsing(false)
    }
  }

  async function handleSubmit() {
    if (!fname || !lname) { setError('Please fill in first name and last name.'); return }
    setSaving(true)
    setError('')
    try {
      let resumePath = null
      let resumeName = null
      if (resumeFile) {
        const path = `resumes/${Date.now()}-${resumeFile.name}`
        const { error: uploadErr } = await supabase.storage.from('resumes').upload(path, resumeFile)
        if (uploadErr) throw uploadErr
        resumePath = path
        resumeName = resumeFile.name
      }
      await addCandidate({ fname, lname, email, phone, linkedin, location, experience, source, role, noteText, resumePath, resumeName })
      onClose()
    } catch (err) {
      setError(err.message)
      setSaving(false)
    }
  }

  return (
    <div className="modal-backdrop open" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal" style={{ width: 560 }}>
        <div className="modal-head">
          <div><div className="modal-title">Add candidate</div><div className="modal-sub">Manually add a new applicant</div></div>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          {error && (
            <div style={{ background: 'var(--red-bg)', border: '1px solid #FCA5A5', borderRadius: 'var(--radius)', padding: '8px 12px', fontSize: 13, color: 'var(--red-text)', marginBottom: 14 }}>{error}</div>
          )}

          {/* Resume upload — at the top so it auto-fills the form */}
          <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '14px 16px', marginBottom: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Upload resume (optional)</div>
            <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 10 }}>PDF or Word doc — AI will auto-fill the form fields below.</div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.doc,.docx"
              style={{ fontSize: 13 }}
              onChange={handleResumeSelect}
              disabled={parsing}
            />
            {parsing && (
              <div style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                <span className="spinner" />Parsing resume…
              </div>
            )}
            {parseStatus && !parsing && (
              <div style={{
                fontSize: 12, marginTop: 8,
                color: parseStatus.startsWith('✓') ? 'var(--green-text)' : 'var(--red-text)',
              }}>
                {parseStatus}
              </div>
            )}
          </div>

          <div className="form-grid">
            <div className="form-row"><label className="form-label">First name *</label><input className="form-input" value={fname} onChange={e => setFname(e.target.value)} placeholder="Jordan" /></div>
            <div className="form-row"><label className="form-label">Last name *</label><input className="form-input" value={lname} onChange={e => setLname(e.target.value)} placeholder="Lee" /></div>
          </div>
          <div className="form-grid">
            <div className="form-row"><label className="form-label">Email</label><input className="form-input" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="jordan@email.com" /></div>
            <div className="form-row"><label className="form-label">Phone</label><input className="form-input" type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+1 (555) 000-0000" /></div>
          </div>
          <div className="form-row"><label className="form-label">LinkedIn</label><input className="form-input" value={linkedin} onChange={e => setLinkedin(e.target.value)} placeholder="https://linkedin.com/in/…" /></div>
          <div className="form-row"><label className="form-label">Location</label><input className="form-input" value={location} onChange={e => setLocation(e.target.value)} placeholder="New York, NY" /></div>
          <div className="form-row"><label className="form-label">Experience summary</label><textarea className="form-input" value={experience} onChange={e => setExperience(e.target.value)} placeholder="Brief background from resume…" rows={3} /></div>
          <div className="form-grid">
            <div className="form-row">
              <label className="form-label">Role applying for (optional)</label>
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
          <button className="btn btn-primary" onClick={handleSubmit} disabled={saving || parsing}>
            {saving ? 'Saving…' : 'Add candidate'}
          </button>
        </div>
      </div>
    </div>
  )
}
