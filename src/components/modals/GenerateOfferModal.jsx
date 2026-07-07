import { useState, useRef, useEffect } from 'react'
import { useApp } from '../../context/AppContext'

export default function GenerateOfferModal({ onClose }) {
  const { candidates, jobs, offerTemplates, addOffer, sendOfferViaDocuSign, previewOffer } = useApp()

  const [candidateId, setCandidateId] = useState('')
  const [candidateSearch, setCandidateSearch] = useState('')
  const [showDropdown, setShowDropdown] = useState(false)
  const [role, setRole] = useState('')
  const [salary, setSalary] = useState('')
  const [startDate, setStartDate] = useState('')
  const [managerTitle, setManagerTitle] = useState('')
  const [commissionAmount, setCommissionAmount] = useState('')
  const [offerExpiration, setOfferExpiration] = useState('')
  const [annualBonus, setAnnualBonus] = useState('')
  const [templateId, setTemplateId] = useState(offerTemplates[0]?.id || '')
  const [sending, setSending] = useState(false)
  const [previewing, setPreviewing] = useState(false)
  const [error, setError] = useState('')
  const searchRef = useRef(null)
  const dropdownRef = useRef(null)

  const selectedCandidate = candidates.find(c => c.id === candidateId)

  // Filter candidates by search input
  const filteredCandidates = candidateSearch.trim()
    ? candidates
        .filter(c => `${c.fname} ${c.lname}`.toLowerCase().includes(candidateSearch.toLowerCase()))
        .sort((a, b) => `${a.fname} ${a.lname}`.localeCompare(`${b.fname} ${b.lname}`))
        .slice(0, 8)
    : []

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e) {
      if (
        searchRef.current && !searchRef.current.contains(e.target) &&
        dropdownRef.current && !dropdownRef.current.contains(e.target)
      ) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  function selectCandidate(c) {
    setCandidateId(c.id)
    setCandidateSearch(`${c.fname} ${c.lname}`)
    setShowDropdown(false)
    // Auto-fill role from their Offer/Hired application
    const offerApp = c.applications?.find(a => a.stage === 'Offer' || a.stage === 'Hired')
    if (offerApp) {
      const job = jobs.find(j => j.id === offerApp.job_id)
      setRole(job?.title || '')
    }
  }

  function handleSearchChange(e) {
    setCandidateSearch(e.target.value)
    setCandidateId('') // clear selection when typing again
    setShowDropdown(true)
  }

  async function handlePreview() {
    if (!templateId) { setError('Select a template first.'); return }
    setPreviewing(true)
    setError('')
    try {
      const signerName = selectedCandidate ? `${selectedCandidate.fname} ${selectedCandidate.lname}` : 'Candidate'
      const { documentBase64, documentName } = await previewOffer({
        templateId, salary, startDate, role, managerTitle, commissionAmount, offerExpiration, annualBonus, signerName,
      })
      const binary = atob(documentBase64)
      const bytes = new Uint8Array(binary.length)
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
      const blob = new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `Preview - ${documentName}`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      setError(`Preview failed: ${err.message}`)
    } finally {
      setPreviewing(false)
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
      const offer = await addOffer({
        candidateId,
        candidateName: `${selectedCandidate.fname} ${selectedCandidate.lname}`,
        jobId: jobs.find(j => j.title === role)?.id || null,
        jobTitle: role,
        salary,
        startDate: startDate || null,
        letterText: '',
      })
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
        annualBonus,
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
          <div>
            <div className="modal-title">Send offer letter</div>
            <div className="modal-sub">Fill in the details — we'll send it via DocuSign</div>
          </div>
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
              <div style={{ position: 'relative' }}>
                <input
                  ref={searchRef}
                  className="form-input"
                  placeholder="Type a name to search…"
                  value={candidateSearch}
                  onChange={handleSearchChange}
                  onFocus={() => { if (candidateSearch.trim()) setShowDropdown(true) }}
                  autoComplete="off"
                />
                {showDropdown && filteredCandidates.length > 0 && (
                  <div
                    ref={dropdownRef}
                    style={{
                      position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 300,
                      background: 'var(--card)', border: '1px solid var(--border)',
                      borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
                      marginTop: 4, overflow: 'hidden',
                    }}
                  >
                    {filteredCandidates.map(c => {
                      const app = c.applications?.find(a => a.stage === 'Offer' || a.stage === 'Hired')
                      const jobTitle = app ? jobs.find(j => j.id === app.job_id)?.title : null
                      return (
                        <div
                          key={c.id}
                          onMouseDown={() => selectCandidate(c)}
                          style={{
                            padding: '10px 14px', cursor: 'pointer',
                            borderBottom: '1px solid var(--border)',
                            transition: 'background 0.1s',
                          }}
                          onMouseEnter={e => e.currentTarget.style.background = 'var(--bg)'}
                          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                        >
                          <div style={{ fontWeight: 600, fontSize: 13 }}>{c.fname} {c.lname}</div>
                          {jobTitle && <div style={{ fontSize: 12, color: 'var(--text-3)' }}>{jobTitle}</div>}
                        </div>
                      )
                    })}
                  </div>
                )}
                {showDropdown && candidateSearch.trim() && filteredCandidates.length === 0 && (
                  <div style={{
                    position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 300,
                    background: 'var(--card)', border: '1px solid var(--border)',
                    borderRadius: 8, padding: '12px 14px', fontSize: 13,
                    color: 'var(--text-3)', marginTop: 4,
                  }}>
                    No candidates found
                  </div>
                )}
              </div>
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
          <div className="form-grid">
            <div className="form-row">
              <label className="form-label">Annual bonus</label>
              <input className="form-input" value={annualBonus} onChange={e => setAnnualBonus(e.target.value)} placeholder="e.g. $5,000 or N/A" />
            </div>
            <div className="form-row" />
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
            className="btn"
            onClick={handlePreview}
            disabled={previewing || sending || !templateId}
            title="Downloads a filled copy to review before sending"
          >
            {previewing ? 'Generating…' : '👁 Preview offer'}
          </button>
          <button
            className="btn btn-primary"
            onClick={handleSend}
            disabled={sending || previewing || offerTemplates.length === 0}
          >
            {sending ? 'Sending…' : 'Send via DocuSign'}
          </button>
        </div>
      </div>
    </div>
  )
}
