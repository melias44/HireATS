import { useState } from 'react'
import { PDFDocument } from 'pdf-lib'
import { useApp, avColor, initials, daysAgo, STAGES } from '../../context/AppContext'
import { supabase } from '../../lib/supabase'

export default function Pipeline() {
  const { candidates, activeCandidates, jobs, offers, openModal, duplicates, moveStage } = useApp()
  const [pipelineTab, setPipelineTab] = useState('active') // 'active' | 'hired'
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [selectMode, setSelectMode] = useState(false)
  const [selected, setSelected] = useState(new Set()) // set of candidateIds
  const [bundling, setBundling] = useState(false)
  const [bundleWarning, setBundleWarning] = useState('')

  // Hired tab: candidates who are Hired and whose start date has already passed
  const todayMidnight = new Date(); todayMidnight.setHours(0, 0, 0, 0)
  const hiredCandidates = candidates.filter(c => {
    const apps = c.applications || []
    if (!apps.some(a => a.stage === 'Hired')) return false
    const offer = offers.find(o => o.candidate_id === c.id && o.start_date)
    if (!offer?.start_date) return false
    return new Date(offer.start_date + 'T00:00:00') < todayMidnight
  })

  const roles = [...new Set(
    activeCandidates.flatMap(c =>
      (c.applications || []).map(a => jobs.find(j => j.id === a.job_id)?.title).filter(Boolean)
    )
  )]

  // Flatten to application-level cards (active pipeline only)
  let cards = activeCandidates.flatMap(c =>
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

  let unassigned = activeCandidates.filter(c => !c.applications || c.applications.length === 0)

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
      {/* Duplicate alert banner */}
      {duplicates.length > 0 && (
        <div
          onClick={() => openModal('mergeCandidates')}
          style={{
            display: 'flex', alignItems: 'center', gap: 10,
            background: '#FFFBEB', border: '1px solid #FDE68A',
            borderRadius: 10, padding: '10px 16px', marginBottom: 14,
            cursor: 'pointer', transition: 'background 0.15s',
          }}
          onMouseEnter={e => e.currentTarget.style.background = '#FEF3C7'}
          onMouseLeave={e => e.currentTarget.style.background = '#FFFBEB'}
        >
          <span style={{ fontSize: 18 }}>⚠️</span>
          <div style={{ flex: 1 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#92400E' }}>
              {duplicates.length} duplicate profile{duplicates.length !== 1 ? 's' : ''} detected
            </span>
            <span style={{ fontSize: 12, color: '#A16207', marginLeft: 8 }}>
              — candidates sharing the same email or phone number
            </span>
          </div>
          <button className="btn btn-sm" style={{ background: '#FDE68A', border: 'none', color: '#92400E', fontWeight: 600 }}>
            Review &amp; merge →
          </button>
        </div>
      )}

      {/* Tab switcher */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 16 }}>
        <button
          onClick={() => setPipelineTab('active')}
          style={{
            padding: '6px 16px', borderRadius: 8, border: '1px solid var(--border)',
            background: pipelineTab === 'active' ? 'var(--accent)' : 'var(--card)',
            color: pipelineTab === 'active' ? '#fff' : 'var(--text-2)',
            fontWeight: 600, fontSize: 13, cursor: 'pointer',
          }}
        >
          Active pipeline
          <span style={{
            marginLeft: 6, fontSize: 11, fontWeight: 700,
            background: pipelineTab === 'active' ? 'rgba(255,255,255,0.25)' : 'var(--bg)',
            borderRadius: 20, padding: '1px 7px',
          }}>
            {activeCandidates.length}
          </span>
        </button>
        <button
          onClick={() => setPipelineTab('hired')}
          style={{
            padding: '6px 16px', borderRadius: 8, border: '1px solid var(--border)',
            background: pipelineTab === 'hired' ? 'var(--accent)' : 'var(--card)',
            color: pipelineTab === 'hired' ? '#fff' : 'var(--text-2)',
            fontWeight: 600, fontSize: 13, cursor: 'pointer',
          }}
        >
          Hired
          <span style={{
            marginLeft: 6, fontSize: 11, fontWeight: 700,
            background: pipelineTab === 'hired' ? 'rgba(255,255,255,0.25)' : 'var(--bg)',
            borderRadius: 20, padding: '1px 7px',
          }}>
            {hiredCandidates.length}
          </span>
        </button>
      </div>

      {pipelineTab === 'active' && (
        <>
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
        </>
      )}

      {pipelineTab === 'hired' && (
        <div>
          {hiredCandidates.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-3)', fontSize: 14 }}>
              No hired candidates with a past start date yet.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 700 }}>
              {hiredCandidates.map(c => {
                const a = avColor(c.fname)
                const offer = offers.find(o => o.candidate_id === c.id && o.start_date)
                const hiredApp = (c.applications || []).find(app => app.stage === 'Hired')
                const jobTitle = hiredApp ? jobs.find(j => j.id === hiredApp.job_id)?.title || '' : ''
                return (
                  <div
                    key={c.id}
                    className="cand-card"
                    onClick={() => openModal('candidateDetail', { candidateId: c.id })}
                    style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', cursor: 'pointer' }}
                  >
                    <div className="avatar" style={{ width: 40, height: 40, fontSize: 14, background: a.bg, color: a.color, flexShrink: 0 }}>
                      {initials(c.fname, c.lname)}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div className="cand-name" style={{ fontSize: 14 }}>{c.fname} {c.lname}</div>
                      <div className="cand-role" style={{ fontSize: 12 }}>{jobTitle}</div>
                    </div>
                    {offer?.start_date && (
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 2 }}>Start date</div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
                          {new Date(offer.start_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </div>
                      </div>
                    )}
                    <span style={{
                      fontSize: 11, fontWeight: 700, borderRadius: 20, padding: '3px 10px',
                      background: '#D1FAE5', color: '#065F46',
                    }}>Hired</span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
