import { useState } from 'react'
import { PDFDocument } from 'pdf-lib'
import { useApp, avColor, initials, daysAgo, STAGES } from '../../context/AppContext'
import { supabase } from '../../lib/supabase'

export default function Pipeline() {
  const { candidates, jobs, openModal, duplicates, moveStage } = useApp()
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [selectMode, setSelectMode] = useState(false)
  const [selected, setSelected] = useState(new Set())
  const [bundling, setBundling] = useState(false)
  const [bundleWarning, setBundleWarning] = useState('')

  const roles = [...new Set(
    candidates.flatMap(c =>
      (c.applications || []).map(a => jobs.find(j => j.id === a.job_id)?.title).filter(Boolean)
    )
  )]

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
  const visibleCandidateIds = [...unassigned.map(c => c.id), ...cards.map(x => x.candidateId)]
  const allVisibleSelected = visibleCandidateIds.length > 0 && visibleCandidateIds.every(id => selected.has(id))

  function toggleSelectMode() { setSelectMode(v => !v); setSelected(new Set()); setBundleWarning('') }
  function selectAllVisible() {
    if (allVisibleSelected) setSelected(new Set())
    else setSelected(new Set(visibleCandidateIds))
  }
  function toggleSelect(candidateId) {
    setSelected(prev => { const next = new Set(prev); if (next.has(candidateId)) next.delete(candidateId); else next.add(candidateId); return next })
  }
  function handleCardClick(candidateId) {
    if (selectMode) toggleSelect(candidateId)
    else openModal('candidateDetail', { candidateId })
  }

  async function handleBundleResumes() {
    if (selected.size === 0) return
    setBundling(true); setBundleWarning('')
    const selectedCandidates = candidates.filter(c => selected.has(c.id))
    const withoutResume = selectedCandidates.filter(c => !c.resume_path)
    const nonPdf = selectedCandidates.filter(c => c.resume_path && !c.resume_name?.toLowerCase().endsWith('.pdf'))
    const pdfCandidates = selectedCandidates.filter(c => c.resume_path && c.resume_name?.toLowerCase().endsWith('.pdf'))
    if (pdfCandidates.length === 0) { setBundleWarning('None of the selected candidates have PDF resumes on file.'); setBundling(false); return }
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
        } catch { }
      }
      const pdfBytes = await merged.save()
      const blob = new Blob([pdfBytes], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a'); a.href = url
      a.download = `resume-bundle-${new Date().toISOString().split('T')[0]}.pdf`
      a.click(); URL.revokeObjectURL(url)
      const warnings = []
      if (withoutResume.length) warnings.push(`${withoutResume.length} had no resume on file.`)
      if (nonPdf.length) warnings.push(`${nonPdf.length} had Word doc resumes (PDF only supported).`)
      if (warnings.length) setBundleWarning(warnings.join(' '))
    } catch (err) { setBundleWarning('Bundle failed: ' + err.message) }
    finally { setBundling(false) }
  }

  return (
    <div>
      {duplicates.length > 0 && (
        <div onClick={() => openModal('mergeCandidates')} style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 10, padding: '10px 16px', marginBottom: 14, cursor: 'pointer', transition: 'background 0.15s' }}
          onMouseEnter={e => e.currentTarget.style.background = '#FEF3C7'} onMouseLeave={e => e.currentTarget.style.background = '#FFFBEB'}>
          <span style={{ fontSize: 18 }}>⚠️</span>
          <div style={{ flex: 1 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#92400E' }}>{duplicates.length} duplicate profile{duplicates.length !== 1 ? 's' :
