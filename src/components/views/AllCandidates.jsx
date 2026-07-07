import { useState, useMemo } from 'react'
import { useApp, avColor, initials, stageStyle, daysAgo } from '../../context/AppContext'

export default function AllCandidates() {
  const { candidates, jobs, openModal } = useApp()
  const [search, setSearch] = useState('')
  const [stageFilter, setStageFilter] = useState('')
  const [sourceFilter, setSourceFilter] = useState('')

  const sources = useMemo(() => [...new Set(candidates.map(c => c.source).filter(Boolean))].sort(), [candidates])

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return candidates.filter(c => {
      // Search across name, email, location, job titles
      if (q) {
        const jobTitles = (c.applications || [])
          .map(a => jobs.find(j => j.id === a.job_id)?.title || '')
          .join(' ')
        const text = `${c.fname} ${c.lname} ${c.email || ''} ${c.location || ''} ${jobTitles}`.toLowerCase()
        if (!text.includes(q)) return false
      }
      // Stage filter — match if any application is in that stage
      if (stageFilter && !(c.applications || []).some(a => a.stage === stageFilter)) return false
      // Source filter
      if (sourceFilter && c.source !== sourceFilter) return false
      return true
    })
  }, [candidates, jobs, search, stageFilter, sourceFilter])

  return (
    <div>
      {/* Search + filters */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        <input
          className="search-input"
          placeholder="Search by name, email, location, or role…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ flex: 1, minWidth: 220 }}
        />
        <select
          className="filter-btn"
          value={stageFilter}
          onChange={e => setStageFilter(e.target.value)}
        >
          <option value="">All stages</option>
          {['Applied', 'Phone Screen', 'Interview', 'Offer', 'Hired', 'Rejected'].map(s => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <select
          className="filter-btn"
          value={sourceFilter}
          onChange={e => setSourceFilter(e.target.value)}
        >
          <option value="">All sources</option>
          {sources.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 12 }}>
        {filtered.length} candidate{filtered.length !== 1 ? 's' : ''}
        {(search || stageFilter || sourceFilter) ? ' matching filters' : ' total'}
      </div>

      {/* Candidate list */}
      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-3)', fontSize: 14 }}>
          No candidates found.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {filtered.map(c => {
            const av = avColor(c.fname)
            const apps = c.applications || []
            return (
              <div
                key={c.id}
                onClick={() => openModal('candidateDetail', { candidateId: c.id })}
                style={{
                  background: 'var(--card)', border: '1px solid var(--border)',
                  borderRadius: 10, padding: '12px 16px',
                  display: 'flex', alignItems: 'center', gap: 14,
                  cursor: 'pointer', transition: 'border-color 0.15s',
                }}
                onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent)'}
                onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
              >
                {/* Avatar */}
                <div
                  className="avatar"
                  style={{ width: 36, height: 36, fontSize: 13, flexShrink: 0, background: av.bg, color: av.color }}
                >
                  {initials(c.fname, c.lname)}
                </div>

                {/* Name + email */}
                <div style={{ minWidth: 160, flex: '0 0 160px' }}>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{c.fname} {c.lname}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-3)' }}>{c.email || '—'}</div>
                </div>

                {/* Applications — job + stage */}
                <div style={{ flex: 1, display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
                  {apps.length === 0 ? (
                    <span style={{ fontSize: 12, color: 'var(--text-3)' }}>No applications</span>
                  ) : (
                    apps.map(a => {
                      const job = jobs.find(j => j.id === a.job_id)
                      const ss = stageStyle(a.stage)
                      return (
                        <span key={a.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12 }}>
                          {job && <span style={{ color: 'var(--text-2)', fontWeight: 500 }}>{job.title}</span>}
                          <span style={{ padding: '2px 8px', borderRadius: 20, background: ss.bg, color: ss.color, fontWeight: 600, fontSize: 11 }}>
                            {a.stage}
                          </span>
                        </span>
                      )
                    })
                  )}
                </div>

                {/* Source + date */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3, flexShrink: 0 }}>
                  {c.source && (
                    <span className="source-tag" style={{ fontSize: 11 }}>{c.source}</span>
                  )}
                  <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{daysAgo(c.created_at)}</span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
