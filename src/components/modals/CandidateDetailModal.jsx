import { useState } from 'react'
import { useApp, avColor, initials, stageStyle, daysAgo, STAGES } from '../../context/AppContext'
import { callAI } from '../../lib/supabase'

export default function CandidateDetailModal({ candidateId, onClose }) {
  const { candidates, jobs, moveStage, addNote, openModal, closeModal } = useApp()
  const [noteText, setNoteText] = useState('')
  const [noteRole, setNoteRole] = useState('General')
  const [aiSummary, setAiSummary] = useState('')
  const [aiLoading, setAiLoading] = useState(false)

  const c = candidates.find(x => x.id === candidateId)
  if (!c) return null

  const av = avColor(c.fname)
  const apps = c.applications || []
  const notes = c.notes || []

  async function handleSaveNote() {
    if (!noteText.trim()) return
    await addNote(c.id, noteText.trim(), noteRole)
    setNoteText('')
  }

  async function handleSummarize() {
    setAiLoading(true)
    setAiSummary('')
    try {
      const appSummary = apps.map(a => {
        const job = jobs.find(j => j.id === a.job_id)
        return `${job?.title || a.role || 'Unknown role'} (${a.stage})`
      }).join(', ')
      const notesSummary = notes.length
        ? notes.map(n => `[${n.job_title}] ${n.text}`).join('. ')
        : 'No notes yet.'
      const text = await callAI(
        `Write a brief 3-4 sentence HR recruiter assessment of ${c.fname} ${c.lname}. They came from ${c.source} and are currently being considered for: ${appSummary}. Notes: ${notesSummary}. Give a concise cross-role assessment — are they a strong candidate overall, which role seems the best fit, and what's the recommended next step? Be specific and practical.`
      )
      setAiSummary(text)
    } catch (err) {
      setAiSummary('AI summary failed. Make sure the Edge Function is deployed.')
    } finally {
      setAiLoading(false)
    }
  }

  return (
    <div className="modal-backdrop open" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal" style={{ width: 740, maxHeight: '88vh' }}>
        <div className="modal-head">
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div className="avatar" style={{ width: 44, height: 44, fontSize: 15, background: av.bg, color: av.color }}>
              {initials(c.fname, c.lname)}
            </div>
            <div>
              <div className="modal-title">{c.fname} {c.lname}</div>
              <div className="modal-sub">{c.source} · {apps.length} application{apps.length !== 1 ? 's' : ''}</div>
            </div>
          </div>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          <div className="detail-grid">
            {/* Left column */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Contact */}
              <div className="detail-card">
                <div className="detail-card-title">Contact info</div>
                <div className="info-row"><span className="info-key">Email</span><span className="info-val">{c.email || '—'}</span></div>
                <div className="info-row"><span className="info-key">Source</span><span className="info-val">{c.source}</span></div>
                <div className="info-row"><span className="info-key">Added</span><span className="info-val">{daysAgo(c.created_at)}</span></div>
                <div className="info-row"><span className="info-key">Applications</span><span className="info-val">{apps.length}</span></div>
              </div>

              {/* Applications */}
              <div className="detail-card">
                <div className="detail-card-title" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  Applications
                  <button className="btn btn-sm" onClick={() => {
                    onClose()
                    setTimeout(() => openModal('addApplication', { candidateId: c.id }), 100)
                  }}>+ Add role</button>
                </div>
                {apps.length === 0 && <div style={{ fontSize: 13, color: 'var(--text-3)' }}>No applications.</div>}
                {apps.map((app, i) => {
                  const job = jobs.find(j => j.id === app.job_id)
                  const sc = stageStyle(app.stage)
                  return (
                    <div key={app.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: i < apps.length - 1 ? '1px solid var(--border)' : 'none' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 600 }}>{job?.title || app.role || '—'}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-3)' }}>Applied {daysAgo(app.applied_at)}</div>
                      </div>
                      <select
                        className="stage-select"
                        style={{ width: 140, fontSize: 12 }}
                        value={app.stage}
                        onChange={e => moveStage(app.id, e.target.value)}
                      >
                        {STAGES.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                  )
                })}
              </div>

              {/* Notes & timeline */}
              <div className="detail-card">
                <div className="detail-card-title">Notes & activity</div>
                <div className="timeline">
                  {apps.map(app => {
                    const job = jobs.find(j => j.id === app.job_id)
                    return (
                      <div key={app.id} className="timeline-item">
                        <div className="tl-dot" style={{ background: 'var(--accent)' }} />
                        <div>
                          <div className="tl-text">Applied for <strong>{job?.title || app.role || '—'}</strong> via {c.source}</div>
                          <div className="tl-time">{daysAgo(app.applied_at)}</div>
                        </div>
                      </div>
                    )
                  })}
                  {notes.map(n => (
                    <div key={n.id} className="timeline-item">
                      <div className="tl-dot" style={{ background: '#8B5CF6' }} />
                      <div>
                        <div className="tl-text">{n.text}</div>
                        <div className="tl-time">{n.job_title} · {daysAgo(n.created_at)}{n.author_name ? ` · ${n.author_name}` : ''}</div>
                      </div>
                    </div>
                  ))}
                  {apps.length === 0 && notes.length === 0 && (
                    <div style={{ color: 'var(--text-3)', fontSize: 13 }}>No activity yet.</div>
                  )}
                </div>
              </div>
            </div>

            {/* Right column */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* AI summary */}
              <div className="detail-card">
                <div className="detail-card-title">AI candidate summary</div>
                <div className="ai-panel" style={{ margin: 0 }}>
                  <div className="ai-panel-head"><div className="ai-dot" />&nbsp;Summary</div>
                  <div className="ai-output">
                    {aiLoading
                      ? <span className="ai-loading"><span className="spinner" />Analyzing…</span>
                      : aiSummary || 'Click "Summarize" to generate an AI assessment.'}
                  </div>
                </div>
                <button className="btn btn-sm" style={{ marginTop: 10, width: '100%' }} onClick={handleSummarize} disabled={aiLoading}>
                  ✨ Summarize candidate
                </button>
              </div>

              {/* Add note */}
              <div className="detail-card">
                <div className="detail-card-title">Add note</div>
                <div className="form-row" style={{ marginBottom: 8 }}>
                  <label className="form-label">Related to</label>
                  <select className="stage-select" value={noteRole} onChange={e => setNoteRole(e.target.value)}>
                    <option value="General">General</option>
                    {apps.map(app => {
                      const job = jobs.find(j => j.id === app.job_id)
                      const title = job?.title || app.role || '—'
                      return <option key={app.id} value={title}>{title}</option>
                    })}
                  </select>
                </div>
                <textarea
                  className="note-input"
                  placeholder="Interview notes, feedback, impressions…"
                  value={noteText}
                  onChange={e => setNoteText(e.target.value)}
                />
                <button className="btn btn-sm" style={{ marginTop: 8, width: '100%' }} onClick={handleSaveNote}>Save note</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
