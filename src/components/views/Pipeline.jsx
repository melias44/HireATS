import { useState } from 'react'
import { PDFDocument } from 'pdf-lib'
import { useApp, avColor, initials, daysAgo, STAGES } from '../../context/AppContext'
import { supabase } from '../../lib/supabase'

export default function Pipeline() {
  const { candidates, jobs, openModal } = useApp()
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [selectMode, setSelectMode] = useState(false)
  const [selected, setSelected] = useState(new Set()) // set of candidateIds
  const [bundling, setBundling] = useState(false)
  const [bundleWarning, setBundleWarning] = useState('')

  const roles = [...new Set(
    candidates.flatMap(c =>
      (c.applications || []).map(a => jobs.find(j => j.id === a.job_id)?.title).filter(Boolean)
    )
  )]

  // Flatten to application-level cards
  let cards = candidates.flatMap(c =>
    (c.applications || []).map(a => ({
      ...a,
      candidateId: c.id,
      fname: c.fname,
      lname: c.lname,
      source: c.source,
      priority: c.priority,
      resume_path: c.resume_path,
      resume_name: c.resume_name,
      multiApp: c.applications.length > 1,
      jobTitle: jobs.find(j => j.id === a.job_id)?.title || '',
    }))
  )

  let unassigned = candidates.filter(c => !c.applications || c.applications.length === 0)

  if (search) {
    const s = search.toLowerCase()
    cards = cards.filter(x => `${x.fname} ${x.lname} ${x.jobTitle}`.toLowerCase().includes(s))
    unassigned = unassigned.filter(c => `${c.fname} ${c.lname}`.toLowerCase().includes(s))
  }
  if (roleFilter) {
    cards = cards.filter(x => x.jobTitle === roleFilter)
    unassigned = []
  }

  const activeStages = STAGES.filter(s => s !== 'Rejected')

  // All candidate IDs currently visible in the filtered view
  const visibleCandidateIds = [
    ...unassigned.map(c => c.id),
    ...cards.map(x => x.candidateId),
  ]
  const allVisibleSelected = visibleCandidateIds.length > 0 &&
    visibleCandidateIds.every(id => selected.has(id))

  function toggleSelectMode() {
    setSelectMode(v => !v)
    setSelected(new Set())
    setBundleWarning('')
  }

  function selectAllVisible() {
    if (allVisibleSelected) {
      setSelected(new Set())
    } else {
      setSelected(new Set(visibleCandidateIds))
    }
  }

  function toggleSelect(candidateId) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(candidateId)) next.delete(candidateId)
      else next.add(candidateId)
      return next
    })
  }

  function handleCardClick(candidateId) {
    if (selectMode) {
      toggleSelect(candidateId)
    } else {
      openModal('candidateDetail', { candidateId })
    }
  }

  async function handleBundleResumes() {
    if (selected.size === 0) return
    setBundling(true)
    setBundleWarning('')

    const selectedCandidates = candidates.filter(c => selected.has(c.id))
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
        } catch {
          // skip individual failures silently
        }
      }

      const pdfBytes = await merged.save()
      const blob = new Blob([pdfBytes], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `resume-bundle-${new Date().toISOString().split('T')[0]}.pdf`
      a.click()
      URL.revokeObjectURL(url)

      const warnings = []
      if (withoutResume.length) warnings.push(`${withoutResume.length} had no resume on file.`)
      if (nonPdf.length) warnings.push(`${nonPdf.length} had Word doc resumes (PDF only supported).`)
      if (warnings.length) setBundleWarning(warnings.join(' '))

    } catch (err) {
      setBundleWarning('Bundle failed: ' + err.message)
    } finally {
      setBundling(false)
    }
  }

  return (
    <div>
      <div className="search-bar" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <input
          className="search-input"
          placeholder="Search candidates…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ flex: 1 }}
        />
        <select
          className="filter-btn"
          value={roleFilter}
          onChange={e => setRoleFilter(e.target.value)}
        >
          <option value="">All roles</option>
          {roles.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
        <button
          className={`btn btn-sm${selectMode ? ' btn-primary' : ''}`}
          onClick={toggleSelectMode}
          style={{ whiteSpace: 'nowrap' }}
        >
          {selectMode ? `✓ Selecting (${selected.size})` : 'Select'}
        </button>
        {selectMode && (
          <button
            className="btn btn-sm"
            onClick={selectAllVisible}
            style={{ whiteSpace: 'nowrap' }}
          >
            {allVisibleSelected ? 'Deselect all' : `Select all${roleFilter ? ` — ${roleFilter}` : ''}`}
          </button>
        )}
      </div>

      <div className="board-wrap">
        <div className="board">
          {/* Unassigned column */}
          {unassigned.length > 0 && (
            <div className="board-col">
              <div className="col-header">
                <span className="col-title">Unassigned</span>
                <span className="col-count">{unassigned.length}</span>
              </div>
              <div className="col-cards">
                {unassigned.map(c => {
                  const a = avColor(c.fname)
                  const isSelected = selected.has(c.id)
                  return (
                    <div
                      key={c.id}
                      className="cand-card"
                      onClick={() => handleCardClick(c.id)}
                      style={isSelected ? { outline: '2px solid var(--accent)', background: 'var(--accent-bg)' } : {}}
                    >
                      <div className="cand-top">
                        {selectMode && (
                          <input type="checkbox" checked={isSelected} onChange={() => toggleSelect(c.id)}
                            onClick={e => e.stopPropagation()} style={{ marginRight: 4 }} />
                        )}
                        <div className="avatar" style={{ width: 32, height: 32, fontSize: 12, background: a.bg, color: a.color }}>
                          {initials(c.fname, c.lname)}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div className="cand-name">{c.fname} {c.lname}</div>
                          <div className="cand-role" style={{ color: 'var(--text-3)' }}>No role assigned</div>
                        </div>
                      </div>
                      <div className="cand-bottom">
                        <span className="source-tag">{c.source}</span>
                        <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{daysAgo(c.created_at)}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

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
                    const isSelected = selected.has(x.candidateId)
                    return (
                      <div
                        key={`${x.candidateId}-${x.id}`}
                        className="cand-card"
                        onClick={() => handleCardClick(x.candidateId)}
                        style={isSelected ? { outline: '2px solid var(--accent)', background: 'var(--accent-bg)' } : {}}
                      >
                        <div className="cand-top">
                          {selectMode && (
                            <input type="checkbox" checked={isSelected} onChange={() => toggleSelect(x.candidateId)}
                              onClick={e => e.stopPropagation()} style={{ marginRight: 4 }} />
                          )}
                          <div className="avatar" style={{ width: 32, height: 32, fontSize: 12, background: a.bg, color: a.color }}>
                            {initials(x.fname, x.lname)}
                          </div>
                          <div style={{ flex: 1 }}>
                            <div className="cand-name">{x.fname} {x.lname}</div>
                            <div className="cand-role">{x.jobTitle}</div>
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

      {/* Floating action bar — appears when candidates are selected */}
      {selectMode && selected.size > 0 && (
        <div style={{
          position: 'fixed', bottom: 28, left: '50%', transform: 'translateX(-50%)',
          background: 'var(--card)', border: '1px solid var(--border)',
          borderRadius: 12, boxShadow: '0 4px 24px rgba(0,0,0,0.12)',
          padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 14,
          zIndex: 500, minWidth: 360,
        }}>
          <span style={{ fontSize: 14, fontWeight: 600 }}>{selected.size} candidate{selected.size !== 1 ? 's' : ''} selected</span>
          <button
            className="btn btn-primary"
            onClick={handleBundleResumes}
            disabled={bundling}
          >
            {bundling ? 'Bundling…' : '📎 Bundle resumes'}
          </button>
          <button className="btn btn-sm" onClick={() => setSelected(new Set())}>Clear</button>
          {bundleWarning && (
            <span style={{ fontSize: 12, color: 'var(--text-3)', maxWidth: 240 }}>{bundleWarning}</span>
          )}
        </div>
      )}
    </div>
  )
}
