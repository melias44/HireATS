import { useState } from 'react'
import { useApp } from '../../context/AppContext'

export default function GenerateOfferModal({ onClose }) {
  const { candidates, jobs, offerTemplates, addOffer, sendOfferViaDocuSign } = useApp()

  const [candidateId, setCandidateId] = useState('')
  const [role, setRole] = useState('')
  const [salary, setSalary] = useState('')
  const [startDate, setStartDate] = useState('')
  const [managerTitle, setManagerTitle] = useState('')
  const [commissionAmount, setCommissionAmount] = useState('')
  const [offerExpiration, setOfferExpiration] = useState('')
  const [templateId, setTemplateId] = useState(offerTemplates[0]?.id || '')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')

  const allCandidates = [...candidates].sort((a, b) => `${a.fname} ${a.lname}`.localeCompare(`${b.fname} ${b.lname}`))
  const selectedCandidate = candidates.find(c => c.id === candidateId)

  function onCandidateChange(id) {
    setCandidateId(id)
    if (!id) { setRole(''); return }
    const c = candidates.find(x => x.id === id)
    const offerApp = c?.applications?.find(a => a.stage === 'Offer' || a.stage === 'Hired')
    if (offerApp) {
      const job = jobs.find(j => j.id === offerApp.job_id)
      setRole(job?.title || '')
    }
  }

  async function handleSend() {
    if (!candidateId) { setError('Select a candidate.'); return }
    if (!templateId) { setError('Select a template.'); return }
    if (!selectedCandidate?.email) { setError('This candidate has no email on file. Add one first.'); return }
    if (!salary) { setError('Enter a salary amount.'); return }

    setSending(true)
    setError('')
    try {
      // 1. Create the offer record
      const offer = await addOffer({
        candidateId,
        candidateName: `${selectedCandidate.fname} ${selectedCandidate.lname}`,
        jobId: jobs.find(j => j.title === role)?.id || null,
        jobTitle: role,
        salary,
        startDate: startDate || null,
        letterText: '',
      })

      // 2. Send via DocuSign immediately
      await sendOfferViaDocuSign(offer.id, {
        signerEmail: selectedCandidate.email,
        signerName: `${selectedCandidate.fname} ${selectedCandidate.lname}`,
        templateId,
        salary,
        startDate,
        role,
        managerTitle,
        commissionAmount,
        offerExpiration,
      })

      onClose()
    } catch (err) {
      setError(err.message || 'Something went wrong. Check your DocuSign credentials.')
      setSending(false)
    }
  }

  return (
    <div className="modal-backdrop open" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal" style={{ width: 580 }}>
        <div className="modal-head">
          <div><div className="modal-title">Send offer letter</div><div className="modal-sub">Fill in the details — we'll send it via DocuSign</div></div>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          {error && (
            <div style={{ background: 'var(--red-bg)', border: '1px solid #FCA5A5', borderRadius: 'var(--radius)', padding: '8px 12px', fontSize: 13, color: 'var(--red-text)', marginBottom: 14 }}>{error}</div>
          )}
          {offerTemplates.length === 0 && (
            <div style={{ background: 'var(--amber-bg)', border: '1px solid #FDE68A', borderRadius: 'var(--radius)', padding: '10px 14px', fontSize: 13, color: 'var(--amber-text)', marginBottom: 16 }}>
              No templates uploaded yet. Go to Offers → Templates to upload your Word doc first.
            </div>
          )}

          {/* Candidate + Template */}
          <div className="form-grid">
            <div className="form-row">
              <label className="form-label">Candidate *</label>
              <select className="form-input" value={candidateId} onChange={e => onCandidateChange(e.target.value)}>
                <option value="">Select candidate…</option>
                {allCandidates.map(c => <option key={c.id} value={c.id}>{c.fname} {c.lname}</option>)}
              </select>
            </div>
            <div className="form-row">
              <label className="form-label">Offer template *</label>
              <select className="form-input" value={templateId} onChange={e => setTemplateId(e.target.value)}>
                <option value="">Select template…</option>
                {offerTemplates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
          </div>

          {/* Offer details */}
          <div className="form-grid">
            <div className="form-row">
              <label className="form-label">Job title</label>
              <input className="form-input" value={role} onChange={e => setRole(e.target.value)} placeholder="e.g. Senior Editor" />
            </div>
            <div className="form-row">
              <label className="form-label">Salary amount *</label>
              <input className="form-input" value={salary} onChange={e => setSalary(e.target.value)} placeholder="e.g. $95,000" />
            </div>
          </div>
          <div className="form-grid">
            <div className="form-row">
              <label className="form-label">Anticipated start date</label>
              <input className="form-input" type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
            </div>
            <div className="form-row">
              <label className="form-label">Offer expiration date</label>
              <input className="form-input" type="date" value={offerExpiration} onChange={e => setOfferExpiration(e.target.value)} />
            </div>
          </div>
          <div className="form-grid">
            <div className="form-row">
              <label className="form-label">Manager title</label>
              <input className="form-input" value={managerTitle} onChange={e => setManagerTitle(e.target.value)} placeholder="e.g. VP of Editorial" />
            </div>
            <div className="form-row">
              <label className="form-label">Commission amount</label>
              <input className="form-input" value={commissionAmount} onChange={e => setCommissionAmount(e.target.value)} placeholder="e.g. $10,000 or N/A" />
            </div>
          </div>

          {selectedCandidate && (
            <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '10px 14px', fontSize: 13, marginTop: 4 }}>
              <span style={{ color: 'var(--text-3)' }}>Sending to: </span>
              <strong>{selectedCandidate.email || <span style={{ color: 'var(--red-text)' }}>No email on file</span>}</strong>
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn" onClick={onClose}>Cancel</button>
          <button
            className="btn btn-primary"
            onClick={handleSend}
            disabled={sending || offerTemplates.length === 0}
          >
            {sending ? 'Sending…' : 'Send via DocuSign'}
          </button>
        </div>
      </div>
    </div>
  )
}
