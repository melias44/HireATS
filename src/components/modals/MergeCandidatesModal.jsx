import { useState } from 'react'
import { useApp, avColor, initials, daysAgo } from '../../context/AppContext'

export default function MergeCandidatesModal({ onClose }) {
  const { duplicates, mergeCandidates, jobs } = useApp()
  const [dismissed, setDismissed] = useState(new Set())       // pair keys user skipped
  const [selections, setSelections] = useState({})             // pairKey → keepId
  const [merging, setMerging] = useState(null)                 // pairKey currently being merged
  const [merged, setMerged] = useState(new Set())              // pair keys that are done
  const [errors, setErrors] = useState({})

  const activePairs = duplicates.filter(p => {
    const key = pairKey(p)
    return !dismissed.has(key) && !merged.has(key)
  })

  function pairKey(p) { return [p.a.id, p.b.id].sort().join('|') }

  function getSelection(p) {
    return selections[pairKey(p)] || p.a.id   // default to first (usually older)
  }

  function setSelection(p, id) {
    setSelections(prev => ({ ...prev, [pairKey(p)]: id }))
  }

  async function handleMerge(p) {
    const key = pairKey(p)
    const keepId    = getSelection(p)
    const discardId = keepId === p.a.id ? p.b.id : p.a.id
    setMerging(key)
    setErrors(prev => ({ ...prev, [key]: null }))
    try {
      await mergeCandidates(keepId, discardId)
      setMerged(prev => new Set([...prev, key]))
    } catch (err) {
      setErrors(prev => ({ ...prev, [key]: err.message }))
    } finally {
      setMerging(null)
    }
  }

  function handleSkip(p) {
    setDismissed(prev => new Set([...prev, pairKey(p)]))
  }

  const done = activePairs.length === 0

  return (
    <div className="modal-backdrop open" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal" style={{ width: 780, maxHeight: '88vh' }}>
        <div className="modal-head">
          <div>
            <div className="modal-title">Duplicate profiles</div>
            <div className="modal-sub">
              {done
                ? 'All duplicates resolved'
                : `${activePairs.length} potential duplicate${activePairs.length !== 1 ? 's' : ''} found — pick which profile to keep`}
            </div>
          </div>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="modal-body" style={{ padding: 0 }}>
          {done ? (
            <div style={{ padding: '48px 24px', textAlign: 'center' }}>
              <div style={{ fontSize: 36, marginBottom: 12 }}>✅</div>
              <div style={{ fontSize: 15, fontWeight: 600 }}>All clean!</div>
              <div style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 4 }}>No more duplicate profiles to review.</div>
              <button className="btn btn-primary" style={{ marginTop: 20 }} onClick={onClose}>Done</button>
            </div>
          ) : (
            activePairs.map((p, idx) => {
              const key      = pairKey(p)
              const keepId   = getSelection(p)
              const isMerging = merging === key
              const err      = errors[key]

              return (
                <div key={key} style={{
                  borderBottom: idx < activePairs.length - 1 ? '1px solid var(--border)' : 'none',
                  padding: '20px 24px',
                }}>
                  {/* Match reason badge */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                    <span style={{
                      fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20,
                      background: '#FEF9C3', color: '#854D0E',
                    }}>
                      {p.reason === 'email' ? '📧 Same email address' : '📞 Same phone number'}
                    </span>
                    <span style={{ fontSize: 12, color: 'var(--text-3)' }}>Select which profile to keep, then merge</span>
                  </div>

                  {/* Side-by-side profiles */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                    {[p.a, p.b].map(c => {
                      const av       = avColor(c.fname)
                      const isKeep   = keepId === c.id
                      const appCount = (c.applications || []).length
                      const jobNames = (c.applications || [])
                        .map(a => jobs.find(j => j.id === a.job_id)?.title || '—')
                        .filter(Boolean)

                      return (
                        <div
                          key={c.id}
                          onClick={() => setSelection(p, c.id)}
                          style={{
                            border: `2px solid ${isKeep ? 'var(--accent)' : 'var(--border)'}`,
                            borderRadius: 10,
                            padding: '14px 16px',
                            cursor: 'pointer',
                            background: isKeep ? 'var(--accent-bg)' : 'var(--card)',
                            transition: 'all 0.15s',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                            <input
                              type="radio"
                              checked={isKeep}
                              onChange={() => setSelection(p, c.id)}
                              onClick={e => e.stopPropagation()}
                            />
                            <div className="avatar" style={{ width: 34, height: 34, fontSize: 13, background: av.bg, color: av.color }}>
                              {initials(c.fname, c.lname)}
                            </div>
                            <div>
                              <div style={{ fontSize: 13, fontWeight: 700 }}>{c.fname} {c.lname}</div>
                              <div style={{ fontSize: 11, color: 'var(--text-3)' }}>Added {daysAgo(c.created_at)}</div>
                            </div>
                            {isKeep && (
                              <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 600, color: 'var(--accent)' }}>Keep</span>
                            )}
                          </div>

                          <div style={{ fontSize: 12, display: 'flex', flexDirection: 'column', gap: 4 }}>
                            {c.email && (
                              <div style={{ display: 'flex', gap: 6 }}>
                                <span style={{ color: 'var(--text-3)', width: 52, flexShrink: 0 }}>Email</span>
                                <span style={{ color: 'var(--text-2)', wordBreak: 'break-all' }}>{c.email}</span>
                              </div>
                            )}
                            {c.phone && (
                              <div style={{ display: 'flex', gap: 6 }}>
                                <span style={{ color: 'var(--text-3)', width: 52, flexShrink: 0 }}>Phone</span>
                                <span style={{ color: 'var(--text-2)' }}>{c.phone}</span>
                              </div>
                            )}
                            {c.source && (
                              <div style={{ display: 'flex', gap: 6 }}>
                                <span style={{ color: 'var(--text-3)', width: 52, flexShrink: 0 }}>Source</span>
                                <span style={{ color: 'var(--text-2)' }}>{c.source}</span>
                              </div>
                            )}
                            {c.resume_path && (
                              <div style={{ display: 'flex', gap: 6 }}>
                                <span style={{ color: 'var(--text-3)', width: 52, flexShrink: 0 }}>Resume</span>
                                <span style={{ color: '#15803D', fontWeight: 600 }}>✓ On file</span>
                              </div>
                            )}
                            {appCount > 0 && (
                              <div style={{ marginTop: 6, paddingTop: 6, borderTop: '1px solid var(--border)' }}>
                                <div style={{ color: 'var(--text-3)', marginBottom: 3 }}>
                                  {appCount} application{appCount !== 1 ? 's' : ''}:
                                </div>
                                {jobNames.map((name, i) => (
                                  <div key={i} style={{ color: 'var(--text-2)', paddingLeft: 8 }}>• {name}</div>
                                ))}
                              </div>
                            )}
                            {appCount === 0 && (
                              <div style={{ marginTop: 4, color: 'var(--text-3)', fontStyle: 'italic' }}>No applications yet</div>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  {/* What happens note */}
                  <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 12 }}>
                    The kept profile will receive all applications, notes, interviews, offers, and references from the discarded profile. The discarded profile will be permanently deleted.
                  </div>

                  {err && (
                    <div style={{ fontSize: 12, color: 'var(--red-text)', background: 'var(--red-bg)', borderRadius: 6, padding: '6px 10px', marginBottom: 10 }}>
                      {err}
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: 10 }}>
                    <button
                      className="btn btn-primary"
                      onClick={() => handleMerge(p)}
                      disabled={isMerging}
                    >
                      {isMerging ? 'Merging…' : '🔀 Merge profiles'}
                    </button>
                    <button
                      className="btn btn-sm"
                      onClick={() => handleSkip(p)}
                      disabled={isMerging}
                    >
                      Skip for now
                    </button>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
