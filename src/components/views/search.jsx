import { useState, useMemo } from 'react'
import { useApp, avColor, initials, stageStyle, primaryApp } from '../../context/AppContext'

// ── Boolean query parser ─────────────────────────────────────────────────────
// Supports:
//   word1 word2        → both must match (implicit AND)
//   word1 OR word2     → either must match
//   -word              → must NOT contain word
//   "exact phrase"     → exact phrase match
function parseQuery(raw) {
  const tokens = []
  const regex = /"([^"]+)"|-(\S+)|(\bOR\b)|(\S+)/g
  let match
  while ((match = regex.exec(raw)) !== null) {
    if (match[1]) tokens.push({ type: 'phrase', value: match[1].toLowerCase() })
    else if (match[2]) tokens.push({ type: 'not', value: match[2].toLowerCase() })
    else if (match[3]) tokens.push({ type: 'or' })
    else tokens.push({ type: 'term', value: match[4].toLowerCase() })
  }
  return tokens
}

function candidateText(c, jobs) {
  const jobTitles = (c.applications || [])
    .map(a => jobs.find(j => j.id === a.job_id)?.title || '')
    .join(' ')
  return [
    c.fname, c.lname, c.email, c.phone,
    c.location, c.experience, c.source,
    c.resume_text,
    jobTitles,
  ].filter(Boolean).join(' ').toLowerCase()
}

function matchesQuery(text, tokens) {
  if (!tokens.length) return false

  // Group tokens by OR boundaries
  // e.g. [term, term, or, term, not] → [[term, term], [term, not]]
  const groups = [[]]
  for (const t of tokens) {
    if (t.type === 'or') groups.push([])
    else groups[groups.length - 1].push(t)
  }

  // Any group can match (OR between groups)
  return groups.some(group => {
    // All tokens in a group must match (AND within group)
    return group.every(t => {
      if (t.type === 'not') return !text.includes(t.value)
      return text.includes(t.value) // term or phrase
    })
  })
}

function getSnippet(text, tokens, maxLen = 140) {
  if (!text) return null
  const lower = text.toLowerCase()
  // Find the first matching term position for context
  for (const t of tokens) {
    if (t.type === 'not' || t.type === 'or') continue
    const idx = lower.indexOf(t.value)
    if (idx === -1) continue
    const start = Math.max(0, idx - 50)
    const end = Math.min(text.length, idx + maxLen - 50)
    let snippet = text.slice(start, end)
    if (start > 0) snippet = '…' + snippet
    if (end < text.length) snippet += '…'
    // Bold the match
    const matchStart = idx - start + (start > 0 ? 1 : 0) // account for ellipsis char
    return snippet
  }
  return text.slice(0, maxLen) + (text.length > maxLen ? '…' : '')
}

// ── Component ────────────────────────────────────────────────────────────────
export default function Search({ onNavigate }) {
  const { candidates, jobs, openModal } = useApp()
  const [query, setQuery] = useState('')

  const tokens = useMemo(() => parseQuery(query.trim()), [query])

  const results = useMemo(() => {
    if (!query.trim()) return []
    return candidates.filter(c => matchesQuery(candidateText(c, jobs), tokens))
  }, [candidates, jobs, tokens, query])

  const resumeIndexed = candidates.filter(c => c.resume_text).length
  const hasResumes = candidates.filter(c => c.resume_path).length

  return (
    <div>
      {/* Search bar */}
      <div style={{ maxWidth: 680, marginBottom: 24 }}>
        <input
          className="search-input"
          style={{ width: '100%', fontSize: 15, padding: '10px 14px', boxSizing: 'border-box' }}
          placeholder='Search candidates… e.g.  "content strategy"  OR  social -intern  OR  NYC editor'
          value={query}
          onChange={e => setQuery(e.target.value)}
          autoFocus
        />
        <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text-3)', display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          <span><strong>word1 word2</strong> — both must match</span>
          <span><strong>word1 OR word2</strong> — either matches</span>
          <span><strong>-word</strong> — exclude</span>
          <span><strong>"exact phrase"</strong> — phrase match</span>
        </div>
      </div>

      {/* Resume index status */}
      {hasResumes > 0 && (
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          background: resumeIndexed < hasResumes ? '#FFFBEB' : 'var(--surface-2)',
          border: `1px solid ${resumeIndexed < hasResumes ? '#FDE68A' : 'var(--border)'}`,
          borderRadius: 8, padding: '6px 12px', marginBottom: 20, fontSize: 12,
        }}>
          {resumeIndexed < hasResumes ? (
            <>
              <span style={{ color: '#92400E' }}>
                ⚠️ {resumeIndexed}/{hasResumes} resumes indexed for search.
              </span>
              <span style={{ color: 'var(--text-3)' }}>
                New uploads index automatically. Older resumes need re-parsing — go to
              </span>
              <button
                className="btn btn-sm"
                style={{ fontSize: 11 }}
                onClick={() => onNavigate?.('settings')}
              >
                Settings → Index resumes
              </button>
            </>
          ) : (
            <span style={{ color: 'var(--text-2)' }}>✓ All {hasResumes} resumes indexed</span>
          )}
        </div>
      )}

      {/* Results */}
      {query.trim() && results.length === 0 && (
        <div style={{ color: 'var(--text-3)', fontSize: 14, padding: '24px 0' }}>
          No candidates match <em>"{query}"</em>
        </div>
      )}

      {results.length > 0 && (
        <div style={{ marginBottom: 8, fontSize: 13, color: 'var(--text-3)' }}>
          {results.length} result{results.length !== 1 ? 's' : ''}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 680 }}>
        {results.map(c => {
          const av = avColor(c.fname)
          const app = primaryApp(c)
          const job = app ? jobs.find(j => j.id === app.job_id) : null
          const stage = app?.stage
          const ss = stage ? stageStyle(stage) : null

          // Build a snippet from resume_text or experience
          const snippetSource = c.resume_text || c.experience || ''
          const snippet = getSnippet(snippetSource, tokens)

          return (
            <div
              key={c.id}
              onClick={() => openModal('candidateDetail', { candidateId: c.id })}
              style={{
                background: 'var(--card)', border: '1px solid var(--border)',
                borderRadius: 10, padding: '14px 16px', cursor: 'pointer',
                transition: 'border-color 0.15s',
              }}
              onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent)'}
              onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <div
                  className="avatar"
                  style={{ width: 36, height: 36, fontSize: 13, flexShrink: 0, background: av.bg, color: av.color }}
                >
                  {initials(c.fname, c.lname)}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 2 }}>
                    <span style={{ fontWeight: 600, fontSize: 14 }}>{c.fname} {c.lname}</span>
                    {job && <span style={{ fontSize: 12, color: 'var(--text-2)' }}>{job.title}</span>}
                    {ss && (
                      <span style={{ fontSize: 11, padding: '1px 8px', borderRadius: 20, background: ss.bg, color: ss.color, fontWeight: 600 }}>
                        {stage}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: snippet ? 6 : 0 }}>
                    {[c.email, c.location].filter(Boolean).join(' · ')}
                  </div>
                  {snippet && (
                    <div style={{
                      fontSize: 12, color: 'var(--text-2)', lineHeight: 1.5,
                      background: 'var(--bg)', borderRadius: 6, padding: '6px 10px',
                      borderLeft: '2px solid var(--accent)',
                    }}>
                      {snippet}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
