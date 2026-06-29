import { useState } from 'react'
import { useApp, avColor, initials, daysAgo, STAGES } from '../../context/AppContext'

export default function Pipeline() {
  const { candidates, jobs, openModal } = useApp()
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('')

  const roles = [...new Set(candidates.flatMap(c => c.applications?.map(a => a.role) || []))]

  // Flatten to application-level cards
  let cards = candidates.flatMap(c =>
    (c.applications || []).map(a => ({
      ...a,
      candidateId: c.id,
      fname: c.fname,
      lname: c.lname,
      source: c.source,
      priority: c.priority,
      multiApp: c.applications.length > 1,
    }))
  )

  if (search) {
    const s = search.toLowerCase()
    cards = cards.filter(x => `${x.fname} ${x.lname} ${x.role}`.toLowerCase().includes(s))
  }
  if (roleFilter) {
    cards = cards.filter(x => x.role === roleFilter)
  }

  const activeStages = STAGES.filter(s => s !== 'Rejected')

  return (
    <div>
      <div className="search-bar">
        <input
          className="search-input"
          placeholder="Search candidates…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <select
          className="filter-btn"
          value={roleFilter}
          onChange={e => setRoleFilter(e.target.value)}
        >
          <option value="">All roles</option>
          {roles.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
      </div>
      <div className="board-wrap">
        <div className="board">
          {activeStages.map(stage => {
            const stageCards = cards.filter(x => x.stage === stage)
            return (
              <div key={stage} className="board-col">
                <div className="col-header">
                  <span className="col-title">{stage}</span>
                  <span className="col-count">{stageCards.length}</span>
                </div>
                <div className="col-cards">
                  {stageCards.map(x => {
                    const a = avColor(x.fname)
                    return (
                      <div key={`${x.candidateId}-${x.id}`} className="cand-card" onClick={() => openModal('candidateDetail', { candidateId: x.candidateId })}>
                        <div className="cand-top">
                          <div className="avatar" style={{ width: 32, height: 32, fontSize: 12, background: a.bg, color: a.color }}>
                            {initials(x.fname, x.lname)}
                          </div>
                          <div style={{ flex: 1 }}>
                            <div className="cand-name">{x.fname} {x.lname}</div>
                            <div className="cand-role">{x.role}</div>
                          </div>
                          {x.priority && <div className="priority-dot" style={{ background: '#EF4444' }} />}
                        </div>
                        <div className="cand-bottom">
                          <span className="source-tag">{x.source}</span>
                          {x.multiApp && (
                            <span style={{ fontSize: 10, color: 'var(--accent-text)', background: 'var(--accent-bg)', borderRadius: 20, padding: '1px 6px' }}>multi-role</span>
                          )}
                          <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{daysAgo(x.applied_at)}</span>
                        </div>
                      </div>
                    )
                  })}
                  {stageCards.length === 0 && (
                    <div style={{ fontSize: 12, color: 'var(--text-3)', textAlign: 'center', padding: '16px 0' }}>—</div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
