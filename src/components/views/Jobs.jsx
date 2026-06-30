import { useState } from 'react'
import { PDFDocument } from 'pdf-lib'
import { useApp, avColor, initials, stageStyle, STAGES, daysAgo } from '../../context/AppContext'
import { supabase } from '../../lib/supabase'

export default function Jobs({ onNavigate }) {
  const { jobs, candidates, openModal, updateJobStatus, moveStage, addNote, user } = useApp()
  const [selectedJobId, setSelectedJobId] = useState(null)
  const [selectedCandidateId, setSelectedCandidateId] = useState(null)
  const [noteText, setNoteText] = useState('')
  const [resumePreviewUrl, setResumePreviewUrl] = useState(null)
  const [resumePreviewName, setResumePreviewName] = useState('')
  const [resumeLoading, setResumeLoading] = useState(false)
  const [selectMode, setSelectMode] = useState(false)
  const [selected, setSelected] = useState(new Set())
  const [bundling, setBundling] = useState(false)
  const [bundleWarning, setBundleWarning] = useState('')

  const selectedJob = jobs.find(j => j.id === selectedJobId)

  function openJobDetail(jobId) {
    setSelectedJobId(jobId)
    const applicants = candidates.filter(c => c.applications?.some(a => a.job_id === jobId))
    if (applicants.length) setSelectedCandidateId(applicants[0].id)
    else setSelectedCandidateId(null)
    setNoteText('')
    setResumePreviewUrl(null)
    setSelectMode(false)
    setSelected(new Set())
    setBundleWarning('')
  }

  function toggleSelectMode(applicants) {
    setSelectMode(v => !v)
    setSelected(new Set())
    setBundleWarning('')
  }

  function toggleSelect(candidateId) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(candidateId)) next.delete(candidateId)
      else next.add(candidateId)
      return next
    })
  }

  function selectAll(applicants) {
    const allIds = applicants.map(c => c.id)
    const allSelected = allIds.every(id => selected.has(id))
    setSelected(allSelected ? new Set() : new Set(allIds))
  }

  async function handleBundleResumes(applicants) {
    if (selected.size === 0) return
    setBundling(true)
    setBundleWarning('')
    const selectedCandidates = applicants.filter(c => selected.has(c.id))
    const withoutResume = selectedCandidates.filter(c => !c.resume_path)
    const nonPdf = selectedCandidates.filter(c => c.resume_path && !c.resume_name?.toLowerCase().endsWith('.pdf'))
    const pdfCandidates = selectedCandidates.filter(c => c.resume_path && c.resume_name?.toLowerCase().endsWith('.pdf'))
    if (pdfCandidates.length === 0) {
      setBundleWarning('None of the selected candidates have PDF resumes on file.')
      setBundling(false)
      return
    }
    try {
      const merged = await PDFDocument.create()
      for (const c of pdfCandidates) {
        try {
          const { data } = await supabase.storage.from('resumes').createSignedUrl(c.resume_path, 120)
          if (!data?.signedUrl) continue
          const res = await fetch(data.signedUrl)
          const bytes = await res.arrayBuffer()
          const pdf = await PDFDocument.load(bytes, { ignoreEncryption: true })
          const pages = await merged.copyPages(pdf, pdf.getPageIndices())
          pages.forEach(p => merged.addPage(p))
        } catch { /* skip individual failures */ }
      }
      const pdfBytes = await merged.save()
      const blob = new Blob([pdfBytes], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${selectedJob.title.replace(/\s+/g, '-').toLowerCase()}-resumes-${new Date().toISOString().split('T')[0]}.pdf`
      a.click()
      URL.revokeObjectURL(url)
      const warnings = []
      if (withoutResume.length) warnings.push(`${withoutResume.length} had no resume on file.`)
      if (nonPdf.length) warnings.push(`${nonPdf.length} had Word doc resumes (skipped).`)
      if (warnings.length) setBundleWarning(warnings.join(' '))
    } catch (err) {
      setBundleWarning('Bundle failed: ' + err.message)
    } finally {
      setBundling(false)
    }
  }

  async function handleViewResume(candidate) {
    if (!candidate.resume_path) return
    setResumeLoading(true)
    const isPdf = candidate.resume_name?.toLowerCase().endsWith('.pdf')
    const { data } = await supabase.storage.from('resumes').createSignedUrl(candidate.resume_path, 300)
    if (data?.signedUrl) {
      if (isPdf) {
        setResumePreviewName(candidate.resume_name)
        setResumePreviewUrl(data.signedUrl)
      } else {
        window.open(`https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(data.signedUrl)}`, '_blank')
      }
    }
    setResumeLoading(false)
  }

  function closeJobDetail() {
    setSelectedJobId(null)
    setSelectedCandidateId(null)
    setNoteText('')
  }

  async function handleMoveStage(applicationId, stage) {
    await moveStage(applicationId, stage)
  }

  async function handleSaveNote(candidateId) {
    if (!noteText.trim()) return
    await addNote(candidateId, noteText.trim(), selectedJob?.title)
    setNoteText('')
  }

  if (selectedJob) {
    const applicants = candidates.filter(c => c.applications?.some(a => a.job_id === selectedJob.id))
    const selectedCandidate = candidates.find(c => c.id === selectedCandidateId)
    const selectedApp = selectedCandidate?.applications?.find(a => a.job_id === selectedJob.id)

    const appCount = (stage) => applicants.filter(c => c.applications.some(a => a.job_id === selectedJob.id && a.stage === stage)).length

    return (
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
          <button className="btn btn-sm" onClick={closeJobDetail}>← Back to postings</button>
          <div style={{ fontSize: 16, fontWeight: 600 }}>{selectedJob.title}</div>
          <div style={{ fontSize: 13, color: 'var(--text-3)' }}>{selectedJob.dept} · {selectedJob.location} · {selectedJob.salary}</div>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            <button className="btn btn-sm" onClick={() => openModal('publishJob', { jobId: selectedJob.id })}>Publish</button>
            <button className="btn btn-sm" onClick={() => updateJobStatus(selectedJob.id, selectedJob.status === 'Active' ? 'Paused' : 'Active')}>
              {selectedJob.status === 'Active' ? 'Pause' : 'Activate'}
            </button>
          </div>
        </div>

        <div className="metrics" style={{ gridTemplateColumns: 'repeat(4,1fr)', marginBottom: 20 }}>
          <div className="metric-card"><div className="metric-label">Total applicants</div><div className="metric-value">{applicants.length}</div></div>
          <div className="metric-card"><div className="metric-label">In interview</div><div className="metric-value">{appCount('Interview')}</div></div>
          <div className="metric-card"><div className="metric-label">Offer stage</div><div className="metric-value">{appCount('Offer')}</div></div>
          <div className="metric-card"><div className="metric-label">Hired</div><div className="metric-value">{appCount('Hired')}</div></div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 16, alignItems: 'start' }}>
          {/* Applicant list */}
          <div className="section-card" style={{ marginBottom: 0 }}>
            <div className="section-head" style={{ padding: '12px 14px', flexWrap: 'wrap', gap: 6 }}>
              <span className="section-title" style={{ fontSize: 13 }}>Applicants</span>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginLeft: 'auto' }}>
                <span style={{ fontSize: 12, color: 'var(--text-3)' }}>{applicants.length} total</span>
                <button
                  className={`btn btn-sm${selectMode ? ' btn-primary' : ''}`}
                  onClick={() => toggleSelectMode(applicants)}
                  style={{ fontSize: 11 }}
                >
                  {selectMode ? `✓ ${selected.size}` : 'Select'}
                </button>
                {selectMode && (
                  <button className="btn btn-sm" style={{ fontSize: 11 }} onClick={() => selectAll(applicants)}>
                    {applicants.every(c => selected.has(c.id)) ? 'Deselect all' : 'Select all'}
                  </button>
                )}
              </div>
            </div>
            <div style={{ maxHeight: 520, overflowY: 'auto' }}>
              {applicants.length === 0 && (
                <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-3)', fontSize: 13 }}>No applicants yet</div>
              )}
              {STAGES.map(stage => {
                const inStage = applicants.filter(c => c.applications.some(a => a.job_id === selectedJob.id && a.stage === stage))
                if (!inStage.length) return null
                return (
                  <div key={stage}>
                    <div style={{ padding: '8px 14px 4px', fontSize: 10, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', background: 'var(--bg)', borderBottom: '1px solid var(--border)' }}>
                      {stage} · {inStage.length}
                    </div>
                    {inStage.map(c => {
                      const a = avColor(c.fname)
                      const isSelected = c.id === selectedCandidateId
                      return (
                        <div
                          key={c.id}
                          onClick={() => {
                            if (selectMode) { toggleSelect(c.id); return }
                            setSelectedCandidateId(c.id); setNoteText(''); setResumePreviewUrl(null)
                          }}
                          style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderBottom: '1px solid var(--border)', cursor: 'pointer', background: isSelected ? 'var(--accent-bg)' : 'transparent', transition: 'background 0.1s', outline: selectMode && selected.has(c.id) ? '2px solid var(--accent)' : 'none', outlineOffset: -2 }}
                        >
                          {selectMode && (
                            <input type="checkbox" checked={selected.has(c.id)} onChange={() => toggleSelect(c.id)} onClick={e => e.stopPropagation()} />
                          )}
                          <div className="avatar" style={{ width: 30, height: 30, fontSize: 11, background: a.bg, color: a.color }}>{initials(c.fname, c.lname)}</div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.fname} {c.lname}</div>
                            <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{c.source}</div>
                          </div>
                          {c.applications.length > 1 && (
                            <span style={{ fontSize: 10, color: 'var(--accent-text)', background: 'var(--accent-bg)', borderRadius: 20, padding: '1px 5px' }}>+{c.applications.length - 1}</span>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Applicant detail panel */}
          <div>
            {!selectedCandidate ? (
              <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '48px 24px', textAlign: 'center', color: 'var(--text-3)' }}>
                <div style={{ fontSize: 32, marginBottom: 10 }}>👤</div>
                <div style={{ fontSize: 14 }}>Select an applicant to view their profile</div>
              </div>
            ) : (
              <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
                {/* Header */}
                <div style={{ padding: '18px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div className="avatar" style={{ width: 44, height: 44, fontSize: 16, background: avColor(selectedCandidate.fname).bg, color: avColor(selectedCandidate.fname).color }}>
                    {initials(selectedCandidate.fname, selectedCandidate.lname)}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 16, fontWeight: 700 }}>{selectedCandidate.fname} {selectedCandidate.lname}</div>
                    <div style={{ fontSize: 13, color: 'var(--text-3)' }}>{selectedCandidate.email || 'No email'} · {selectedCandidate.source}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {selectedCandidate.resume_path && (
                      <button
                        className="btn btn-sm"
                        onClick={() => handleViewResume(selectedCandidate)}
                        disabled={resumeLoading}
                      >
                        {resumeLoading ? 'Loading…' : '👁 Resume'}
                      </button>
                    )}
                    <button className="btn btn-sm" onClick={() => openModal('candidateDetail', { candidateId: selectedCandidate.id })}>Full profile ↗</button>
                  </div>
                </div>

                {/* Stage mover */}
                {selectedApp && (
                  <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', width: 80 }}>Stage</div>
                    <select
                      className="stage-select"
                      style={{ width: 160, fontSize: 13 }}
                      value={selectedApp.stage}
                      onChange={e => handleMoveStage(selectedApp.id, e.target.value)}
                    >
                      {STAGES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                    <span className="status-pill" style={{ background: stageStyle(selectedApp.stage).bg, color: stageStyle(selectedApp.stage).color }}>{selectedApp.stage}</span>
                  </div>
                )}

                {/* Other roles */}
                {selectedCandidate.applications.length > 1 && (
                  <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)' }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Also applying for</div>
                    {selectedCandidate.applications.filter(a => a.job_id !== selectedJob.id).map(a => {
                      const s2 = stageStyle(a.stage)
                      const otherJob = jobs.find(j => j.id === a.job_id)
                      return (
                        <div key={a.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 13, padding: '4px 0' }}>
                          <span style={{ color: 'var(--text-2)' }}>{otherJob?.title || a.role || '—'}</span>
                          <span className="status-pill" style={{ background: s2.bg, color: s2.color, fontSize: 10 }}>{a.stage}</span>
                        </div>
                      )
                    })}
                  </div>
                )}

                {/* Notes */}
                <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>Notes</div>
                  {selectedCandidate.notes.length === 0
                    ? <div style={{ fontSize: 13, color: 'var(--text-3)' }}>No notes yet.</div>
                    : selectedCandidate.notes.map(n => (
                      <div key={n.id} style={{ fontSize: 13, color: 'var(--text-2)', padding: '7px 10px', background: 'var(--bg)', borderRadius: 'var(--radius)', marginBottom: 6 }}>
                        {n.text}
                        <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 3, display: 'flex', gap: 8 }}>
                          <span style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 4, padding: '1px 6px' }}>{n.job_title}</span>
                          <span>{daysAgo(n.created_at)}</span>
                        </div>
                      </div>
                    ))}
                </div>

                {/* Add note */}
                <div style={{ padding: '16px 20px', borderBottom: resumePreviewUrl ? '1px solid var(--border)' : 'none' }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Add note</div>
                  <textarea
                    className="note-input"
                    placeholder="Interview feedback, impressions…"
                    style={{ width: '100%' }}
                    value={noteText}
                    onChange={e => setNoteText(e.target.value)}
                  />
                  <button className="btn btn-sm btn-primary" style={{ marginTop: 8 }} onClick={() => handleSaveNote(selectedCandidate.id)}>
                    Save note
                  </button>
                </div>

                {/* Inline resume preview */}
                {resumePreviewUrl && (
                  <div style={{ padding: '0' }}>
                    <div style={{ padding: '10px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg)', borderBottom: '1px solid var(--border)' }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                        Resume — {resumePreviewName}
                      </span>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <a href={resumePreviewUrl} download={resumePreviewName} className="btn btn-sm">↓ Download</a>
                        <button className="btn btn-sm" onClick={() => setResumePreviewUrl(null)}>✕ Close</button>
                      </div>
                    </div>
                    <iframe
                      src={resumePreviewUrl}
                      style={{ width: '100%', height: 600, border: 'none', display: 'block' }}
                      title="Resume preview"
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Floating bundle bar */}
        {selectMode && selected.size > 0 && (
          <div style={{ position: 'fixed', bottom: 28, left: '50%', transform: 'translateX(-50%)', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, boxShadow: '0 4px 24px rgba(0,0,0,0.12)', padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 14, zIndex: 500, minWidth: 360 }}>
            <span style={{ fontSize: 14, fontWeight: 600 }}>{selected.size} candidate{selected.size !== 1 ? 's' : ''} selected</span>
            <button className="btn btn-primary" onClick={() => handleBundleResumes(applicants)} disabled={bundling}>
              {bundling ? 'Bundling…' : '📎 Bundle resumes'}
            </button>
            <button className="btn btn-sm" onClick={() => setSelected(new Set())}>Clear</button>
            {bundleWarning && <span style={{ fontSize: 12, color: 'var(--text-3)', maxWidth: 240 }}>{bundleWarning}</span>}
          </div>
        )}
      </div>
    )
  }

  // Jobs list view
  return (
    <div className="section-card">
      <div className="section-head">
        <span className="section-title">All job postings</span>
        <button className="btn btn-sm btn-primary" onClick={() => openModal('addJob')}>+ New posting</button>
      </div>
      <div className="table-wrap">
        {jobs.length === 0 ? (
          <div className="empty-state"><div className="empty-icon">💼</div><div className="empty-text">No jobs yet — create your first posting.</div></div>
        ) : (
          <table>
            <thead>
              <tr><th>Job title</th><th>Department</th><th>Location</th><th>Status</th><th>Published to</th><th>Applicants</th><th>Posted</th><th></th></tr>
            </thead>
            <tbody>
              {jobs.map(j => {
                const appCount = candidates.filter(c => c.applications?.some(a => a.job_id === j.id)).length
                return (
                  <tr key={j.id} style={{ cursor: 'pointer' }} onClick={() => openJobDetail(j.id)}>
                    <td>
                      <div style={{ fontWeight: 600, color: 'var(--accent-text)' }}>{j.title}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{j.employment_type}</div>
                    </td>
                    <td>{j.dept}</td>
                    <td>{j.location}</td>
                    <td><span className={`status-pill pill-${j.status?.toLowerCase()}`}>{j.status}</span></td>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <span style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 5 }}>
                          <span style={{ width: 7, height: 7, borderRadius: '50%', background: j.careers_published ? '#16A34A' : '#9A9590', display: 'inline-block' }} />
                          <span style={{ color: j.careers_published ? 'var(--green-text)' : 'var(--text-3)' }}>Careers page</span>
                        </span>
                        <span style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 5 }}>
                          <span style={{ width: 7, height: 7, borderRadius: '50%', background: j.linkedin_published ? '#0A66C2' : '#9A9590', display: 'inline-block' }} />
                          <span style={{ color: j.linkedin_published ? '#0A66C2' : 'var(--text-3)' }}>LinkedIn</span>
                        </span>
                      </div>
                    </td>
                    <td><strong>{appCount}</strong></td>
                    <td>{j.posted_at ? new Date(j.posted_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}</td>
                    <td style={{ whiteSpace: 'nowrap' }} onClick={e => e.stopPropagation()}>
                      <button className="btn btn-sm" style={{ marginRight: 4 }} onClick={() => openModal('publishJob', { jobId: j.id })}>Publish</button>
                      <button className="btn btn-sm" onClick={() => updateJobStatus(j.id, j.status === 'Active' ? 'Paused' : 'Active')}>
                        {j.status === 'Active' ? 'Pause' : 'Activate'}
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
