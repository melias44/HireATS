import { useState, useRef } from 'react'
import { useApp } from '../../context/AppContext'

const DOCUSIGN_STATUS_LABELS = {
  not_sent: { label: 'Not sent', bg: '#F1F5F9', color: '#475569' },
  sent: { label: 'Sent for signature', bg: '#FFFBEB', color: '#92400E' },
  completed: { label: 'Signed', bg: '#F0FDF4', color: '#15803D' },
  declined: { label: 'Declined', bg: '#FEF2F2', color: '#991B1B' },
  voided: { label: 'Voided', bg: '#F1F5F9', color: '#475569' },
}

export default function Offers() {
  const { offers, offerTemplates, candidates, jobs, updateOfferStatus, uploadOfferTemplate, deleteOfferTemplate, sendOfferViaDocuSign, openModal } = useApp()
  const [tab, setTab] = useState('offers') // 'offers' | 'templates'
  const [sendingId, setSendingId] = useState(null)
  const [sendModal, setSendModal] = useState(null) // offer object
  const [templateName, setTemplateName] = useState('')
  const [uploadError, setUploadError] = useState('')
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef()

  // Send modal state
  const [selectedTemplateId, setSelectedTemplateId] = useState('')
  const [sendError, setSendError] = useState('')
  const [sending, setSending] = useState(false)

  function openSendModal(offer) {
    setSendModal(offer)
    setSelectedTemplateId(offerTemplates[0]?.id || '')
    setSendError('')
  }

  async function handleSend() {
    if (!sendModal) return
    if (!selectedTemplateId) { setSendError('Select a template.'); return }
    const c = candidates.find(x => x.id === sendModal.candidate_id)
    if (!c?.email) { setSendError('Candidate has no email address on file. Add one first.'); return }
    setSending(true)
    setSendError('')
    try {
      await sendOfferViaDocuSign(sendModal.id, {
        signerEmail: c.email,
        signerName: sendModal.candidate_name,
        templateId: selectedTemplateId,
        salary: sendModal.salary,
        startDate: sendModal.start_date,
        role: sendModal.job_title,
      })
      setSendModal(null)
    } catch (err) {
      setSendError(err.message || 'DocuSign send failed. Check your credentials in Vercel.')
    } finally {
      setSending(false)
    }
  }

  async function handleUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!templateName.trim()) { setUploadError('Enter a template name first.'); return }
    setUploadError('')
    setUploading(true)
    try {
      await uploadOfferTemplate(file, templateName.trim())
      setTemplateName('')
      fileInputRef.current.value = ''
    } catch (err) {
      setUploadError(err.message)
    } finally {
      setUploading(false)
    }
  }

  return (
    <div>
      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '1px solid var(--border)', paddingBottom: 0 }}>
        {[['offers', 'Offers'], ['templates', 'Templates']].map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 14, fontWeight: tab === key ? 600 : 400,
              color: tab === key ? 'var(--text)' : 'var(--text-3)',
              padding: '8px 16px',
              borderBottom: tab === key ? '2px solid var(--accent)' : '2px solid transparent',
              marginBottom: -1,
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'offers' && (
        <div className="section-card">
          <div className="section-head">
            <span className="section-title">Offer letters</span>
            <button className="btn btn-sm btn-primary" onClick={() => openModal('generateOffer')}>+ New offer</button>
          </div>
          <div className="table-wrap">
            {offers.length === 0 ? (
              <div className="empty-state"><div className="empty-icon">📄</div><div className="empty-text">No offers yet.</div></div>
            ) : (
              <table>
                <thead>
                  <tr><th>Candidate</th><th>Role</th><th>Salary</th><th>Start date</th><th>Offer status</th><th>DocuSign</th><th></th></tr>
                </thead>
                <tbody>
                  {offers.map(o => {
                    const ds = DOCUSIGN_STATUS_LABELS[o.docusign_status || 'not_sent']
                    return (
                      <tr key={o.id}>
                        <td><div style={{ fontWeight: 600 }}>{o.candidate_name}</div></td>
                        <td>{o.job_title}</td>
                        <td>{o.salary}</td>
                        <td>{o.start_date ? new Date(o.start_date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}</td>
                        <td>
                          <span className={`status-pill ${o.status === 'Accepted' ? 'pill-active' : o.status === 'Declined' ? 'pill-closed' : 'pill-paused'}`}>
                            {o.status}
                          </span>
                        </td>
                        <td>
                          <span className="status-pill" style={{ background: ds.bg, color: ds.color }}>{ds.label}</span>
                        </td>
                        <td style={{ whiteSpace: 'nowrap' }}>
                          {o.docusign_status === 'not_sent' || !o.docusign_status ? (
                            <button
                              className="btn btn-sm btn-primary"
                              onClick={() => openSendModal(o)}
                              disabled={offerTemplates.length === 0}
                              title={offerTemplates.length === 0 ? 'Upload a template first' : ''}
                            >
                              Send via DocuSign
                            </button>
                          ) : (
                            <button className="btn btn-sm" onClick={() => openSendModal(o)}>Resend</button>
                          )}
                          {o.status === 'Pending' && (
                            <>
                              <button className="btn btn-sm" style={{ marginLeft: 4, background: 'var(--green-bg)', color: 'var(--green-text)', borderColor: '#BBF7D0' }} onClick={() => updateOfferStatus(o.id, 'Accepted')}>Accept</button>
                              <button className="btn btn-sm btn-danger" style={{ marginLeft: 4 }} onClick={() => updateOfferStatus(o.id, 'Declined')}>Decline</button>
                            </>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {tab === 'templates' && (
        <div>
          {/* Upload new template */}
          <div className="section-card" style={{ marginBottom: 20 }}>
            <div className="section-head"><span className="section-title">Upload template</span></div>
            <div style={{ padding: '20px 24px' }}>
              {uploadError && (
                <div style={{ background: 'var(--red-bg)', border: '1px solid #FCA5A5', borderRadius: 'var(--radius)', padding: '8px 12px', fontSize: 13, color: 'var(--red-text)', marginBottom: 14 }}>{uploadError}</div>
              )}
              <div className="form-grid" style={{ alignItems: 'end' }}>
                <div className="form-row" style={{ marginBottom: 0 }}>
                  <label className="form-label">Template name</label>
                  <input className="form-input" value={templateName} onChange={e => setTemplateName(e.target.value)} placeholder="e.g. Full-time Offer Letter" />
                </div>
                <div className="form-row" style={{ marginBottom: 0 }}>
                  <label className="form-label">Word file (.docx)</label>
                  <input ref={fileInputRef} type="file" accept=".docx,.doc,.pdf" className="form-input" style={{ padding: '6px 12px' }} onChange={handleUpload} disabled={uploading} />
                </div>
              </div>
              {uploading && <div style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 10 }}>Uploading…</div>}
              <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 10 }}>
                Tip: Add <strong>/sig1/</strong> anywhere in your document where you want the signature to appear, and <strong>/date1/</strong> for the date.
              </div>
            </div>
          </div>

          {/* Template list */}
          <div className="section-card">
            <div className="section-head"><span className="section-title">Your templates</span></div>
            {offerTemplates.length === 0 ? (
              <div className="empty-state"><div className="empty-icon">📁</div><div className="empty-text">No templates yet — upload a Word doc above.</div></div>
            ) : (
              <table>
                <thead><tr><th>Name</th><th>File</th><th>Uploaded</th><th></th></tr></thead>
                <tbody>
                  {offerTemplates.map(t => (
                    <tr key={t.id}>
                      <td style={{ fontWeight: 600 }}>{t.name}</td>
                      <td style={{ color: 'var(--text-3)' }}>{t.file_name}</td>
                      <td style={{ color: 'var(--text-3)' }}>{new Date(t.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</td>
                      <td>
                        <button className="btn btn-sm btn-danger" onClick={() => deleteOfferTemplate(t.id, t.file_path)}>Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* DocuSign send modal */}
      {sendModal && (
        <div className="modal-backdrop open" onClick={e => { if (e.target === e.currentTarget) setSendModal(null) }}>
          <div className="modal" style={{ width: 480 }}>
            <div className="modal-head">
              <div>
                <div className="modal-title">Send via DocuSign</div>
                <div className="modal-sub">{sendModal.candidate_name} — {sendModal.job_title}</div>
              </div>
              <button className="modal-close" onClick={() => setSendModal(null)}>×</button>
            </div>
            <div className="modal-body">
              {sendError && (
                <div style={{ background: 'var(--red-bg)', border: '1px solid #FCA5A5', borderRadius: 'var(--radius)', padding: '8px 12px', fontSize: 13, color: 'var(--red-text)', marginBottom: 14 }}>{sendError}</div>
              )}
              <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '12px 16px', marginBottom: 18, fontSize: 13 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ color: 'var(--text-3)' }}>Sending to</span>
                  <span style={{ fontWeight: 600 }}>{candidates.find(c => c.id === sendModal.candidate_id)?.email || 'No email on file'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ color: 'var(--text-3)' }}>Salary</span>
                  <span>{sendModal.salary}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-3)' }}>Start date</span>
                  <span>{sendModal.start_date || 'TBD'}</span>
                </div>
              </div>
              <div className="form-row">
                <label className="form-label">Offer letter template</label>
                <select className="form-input" value={selectedTemplateId} onChange={e => setSelectedTemplateId(e.target.value)}>
                  <option value="">Select template…</option>
                  {offerTemplates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
              <div style={{ background: 'var(--accent-bg)', border: '1px solid #BFDBFE', borderRadius: 'var(--radius)', padding: '10px 14px', fontSize: 12, color: 'var(--accent-text)' }}>
                The candidate will receive an email from DocuSign with your offer letter attached. Once they sign, the status updates automatically.
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn" onClick={() => setSendModal(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSend} disabled={sending || !selectedTemplateId}>
                {sending ? 'Sending…' : 'Send for signature'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
