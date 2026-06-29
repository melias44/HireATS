import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'

const AppContext = createContext(null)
export const useApp = () => useContext(AppContext)

export const STAGES = ['Applied', 'Phone Screen', 'Interview', 'Offer', 'Hired', 'Rejected']
export const AV_COLORS = [
  { bg: '#EEF4FF', color: '#1D4ED8' },
  { bg: '#F5F3FF', color: '#5B21B6' },
  { bg: '#FFFBEB', color: '#92400E' },
  { bg: '#F0FDF4', color: '#15803D' },
  { bg: '#FEF2F2', color: '#991B1B' },
  { bg: '#F0F9FF', color: '#0369A1' },
]
export const COLORS = ['#3B82F6', '#8B5CF6', '#F59E0B', '#10B981', '#6366F1', '#EF4444']

export function avColor(name) {
  if (!name) return AV_COLORS[0]
  return AV_COLORS[name.charCodeAt(0) % AV_COLORS.length]
}
export function initials(fname, lname) {
  return (fname?.[0] ?? '') + (lname?.[0] ?? '')
}
export function daysAgo(dateStr) {
  if (!dateStr) return '—'
  const ms = Date.now() - new Date(dateStr).getTime()
  const d = Math.floor(ms / 86400000)
  if (d === 0) return 'Today'
  if (d === 1) return 'Yesterday'
  return `${d}d ago`
}
export function stageStyle(stage) {
  const map = {
    Applied: { bg: '#EEF4FF', color: '#1D4ED8' },
    'Phone Screen': { bg: '#F5F3FF', color: '#5B21B6' },
    Interview: { bg: '#FFFBEB', color: '#92400E' },
    Offer: { bg: '#ECFDF5', color: '#065F46' },
    Hired: { bg: '#F0FDF4', color: '#15803D' },
    Rejected: { bg: '#FEF2F2', color: '#991B1B' },
  }
  return map[stage] || { bg: '#F1F5F9', color: '#475569' }
}
export function primaryApp(candidate) {
  const apps = candidate.applications || []
  if (!apps.length) return null
  const order = ['Hired', 'Offer', 'Interview', 'Phone Screen', 'Applied', 'Rejected']
  return [...apps].sort((a, b) => order.indexOf(a.stage) - order.indexOf(b.stage))[0]
}

// ── Provider ──────────────────────────────────────────────────────
export function AppProvider({ children, user }) {
  const [candidates, setCandidates] = useState([])
  const [jobs, setJobs] = useState([])
  const [interviews, setInterviews] = useState([])
  const [offers, setOffers] = useState([])
  const [notes, setNotes] = useState([])
  const [offerTemplates, setOfferTemplates] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null)   // { name, props? }

  // ── Initial load ─────────────────────────────────────────────
  const loadAll = useCallback(async () => {
    setLoading(true)
    const [
      { data: jobsData },
      { data: candidatesData },
      { data: appsData },
      { data: notesData },
      { data: interviewsData },
      { data: offersData },
      { data: templatesData },
    ] = await Promise.all([
      supabase.from('jobs').select('*').order('created_at', { ascending: false }),
      supabase.from('candidates').select('*').order('created_at', { ascending: false }),
      supabase.from('applications').select('*').order('applied_at', { ascending: false }),
      supabase.from('notes').select('*').order('created_at', { ascending: false }),
      supabase.from('interviews').select('*').order('scheduled_at', { ascending: true }),
      supabase.from('offers').select('*').order('created_at', { ascending: false }),
      supabase.from('offer_templates').select('*').order('created_at', { ascending: false }),
    ])

    // Attach applications + notes to each candidate
    const enriched = (candidatesData || []).map(c => ({
      ...c,
      applications: (appsData || []).filter(a => a.candidate_id === c.id),
      notes: (notesData || []).filter(n => n.candidate_id === c.id),
    }))

    setJobs(jobsData || [])
    setCandidates(enriched)
    setInterviews(interviewsData || [])
    setOffers(offersData || [])
    setNotes(notesData || [])
    setOfferTemplates(templatesData || [])
    setLoading(false)
  }, [])

  useEffect(() => { loadAll() }, [loadAll])

  // ── Realtime subscriptions ────────────────────────────────────
  useEffect(() => {
    const channel = supabase
      .channel('hire-ats-all')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'candidates' }, loadAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'applications' }, loadAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notes' }, loadAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'jobs' }, loadAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'interviews' }, loadAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'offers' }, loadAll)
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [loadAll])

  // ── Mutations ─────────────────────────────────────────────────
  async function addCandidate({ fname, lname, email, source, role, noteText, phone, linkedin, location, experience, resumePath, resumeName }) {
    const { data: c, error } = await supabase
      .from('candidates')
      .insert({
        fname, lname, email, source, created_by: user.id,
        phone: phone || null,
        linkedin: linkedin || null,
        location: location || null,
        experience: experience || null,
        resume_path: resumePath || null,
        resume_name: resumeName || null,
      })
      .select()
      .single()
    if (error) throw error

    // Find job_id
    const job = jobs.find(j => j.title === role)
    if (job) {
      await supabase.from('applications').insert({
        candidate_id: c.id,
        job_id: job.id,
        stage: 'Applied',
      })
    }
    if (noteText) {
      await supabase.from('notes').insert({
        candidate_id: c.id,
        job_title: role,
        text: noteText,
        author_id: user.id,
        author_name: user.email,
      })
    }
    return c
  }

  async function addJob({ title, dept, location, employment_type, salary, description }) {
    const { data, error } = await supabase
      .from('jobs')
      .insert({
        title, dept, location, employment_type, salary, description,
        status: 'Active',
        posted_at: new Date().toISOString(),
        created_by: user.id,
      })
      .select()
      .single()
    if (error) throw error
    return data
  }

  async function updateJobStatus(jobId, status) {
    await supabase.from('jobs').update({ status }).eq('id', jobId)
  }

  async function updateJobPublish(jobId, fields) {
    await supabase.from('jobs').update(fields).eq('id', jobId)
  }

  async function moveStage(applicationId, stage) {
    await supabase.from('applications').update({ stage }).eq('id', applicationId)
  }

  async function addApplication(candidateId, jobId) {
    await supabase.from('applications').insert({
      candidate_id: candidateId,
      job_id: jobId,
      stage: 'Applied',
    })
  }

  async function addNote(candidateId, text, jobTitle, applicationId) {
    await supabase.from('notes').insert({
      candidate_id: candidateId,
      application_id: applicationId || null,
      job_title: jobTitle || 'General',
      text,
      author_id: user.id,
      author_name: user.email,
    })
  }

  async function addInterview({ candidateId, candidateName, jobId, jobTitle, interviewer, type, scheduledAt }) {
    await supabase.from('interviews').insert({
      candidate_id: candidateId,
      candidate_name: candidateName,
      job_id: jobId || null,
      job_title: jobTitle || '',
      interviewer,
      interview_type: type,
      scheduled_at: scheduledAt,
    })
  }

  async function addOffer({ candidateId, candidateName, jobId, jobTitle, salary, startDate, letterText }) {
    const { data, error } = await supabase.from('offers').insert({
      candidate_id: candidateId,
      candidate_name: candidateName,
      job_id: jobId || null,
      job_title: jobTitle || '',
      salary,
      start_date: startDate || null,
      letter_text: letterText || '',
      status: 'Pending',
    }).select().single()
    if (error) throw error
    return data
  }

  async function updateOfferStatus(offerId, status) {
    await supabase.from('offers').update({ status }).eq('id', offerId)
  }

  async function updateOfferDocuSign(offerId, fields) {
    await supabase.from('offers').update(fields).eq('id', offerId)
  }

  async function uploadOfferTemplate(file, name) {
    const path = `offer-templates/${Date.now()}-${file.name}`
    const { error: uploadError } = await supabase.storage
      .from('offer-templates')
      .upload(path, file)
    if (uploadError) throw uploadError
    const { data, error } = await supabase.from('offer_templates').insert({
      name,
      file_path: path,
      file_name: file.name,
      created_by: user.id,
    }).select().single()
    if (error) throw error
    return data
  }

  async function deleteOfferTemplate(templateId, filePath) {
    await supabase.storage.from('offer-templates').remove([filePath])
    await supabase.from('offer_templates').delete().eq('id', templateId)
  }

  function buildSubstitutions({ signerName, role, salary, startDate, managerTitle, commissionAmount, offerExpiration, annualBonus }) {
    const fmt = d => d ? new Date(d + 'T12:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : ''
    const today = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    return {
      'job_title': role || '',
      'salary_amount': salary || '',
      'anticipated_start_date': startDate ? fmt(startDate) : 'TBD',
      'custom_manager_title': managerTitle || '',
      'custom_commission_amount': commissionAmount || '',
      'offer_expiration_date': offerExpiration ? fmt(offerExpiration) : '',
      'candidate_name': signerName || '',
      'today_date': today,
      'offered_annual_bonus': annualBonus || '',
    }
  }

  async function previewOffer({ templateId, salary, startDate, role, managerTitle, commissionAmount, offerExpiration, annualBonus, signerName }) {
    const template = offerTemplates.find(t => t.id === templateId)
    if (!template) throw new Error('Template not found')
    const { data: fileData, error: dlError } = await supabase.storage.from('offer-templates').download(template.file_path)
    if (dlError) throw dlError
    const arrayBuffer = await fileData.arrayBuffer()
    const uint8 = new Uint8Array(arrayBuffer)
    let binary = ''
    uint8.forEach(b => binary += String.fromCharCode(b))
    const documentBase64 = btoa(binary)
    const { data, error } = await supabase.functions.invoke('docusign-send', {
      body: {
        documentBase64,
        documentName: template.file_name,
        substitutions: buildSubstitutions({ signerName, role, salary, startDate, managerTitle, commissionAmount, offerExpiration, annualBonus }),
        previewOnly: true,
      },
    })
    if (error) throw error
    return { documentBase64: data.documentBase64, documentName: data.documentName }
  }

  async function sendOfferViaDocuSign(offerId, { signerEmail, signerName, templateId, salary, startDate, role, managerTitle, commissionAmount, offerExpiration, annualBonus }) {
    // 1. Download the template file from Supabase Storage
    const template = offerTemplates.find(t => t.id === templateId)
    if (!template) throw new Error('Template not found')
    const { data: fileData, error: dlError } = await supabase.storage
      .from('offer-templates')
      .download(template.file_path)
    if (dlError) throw dlError

    // 2. Convert to base64
    const arrayBuffer = await fileData.arrayBuffer()
    const uint8 = new Uint8Array(arrayBuffer)
    let binary = ''
    uint8.forEach(b => binary += String.fromCharCode(b))
    const documentBase64 = btoa(binary)

    // 3. Call the Edge Function
    const today = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    const { data, error } = await supabase.functions.invoke('docusign-send', {
      body: {
        signerEmail,
        signerName,
        documentBase64,
        documentName: template.file_name,
        emailSubject: `Your offer letter — ${role}`,
        emailBlurb: `Please review and sign your offer letter for the ${role} position. Salary: ${salary}. Start date: ${startDate || 'TBD'}.`,
        substitutions: buildSubstitutions({ signerName, role, salary, startDate, managerTitle, commissionAmount, offerExpiration, annualBonus }),
      },
    })
    if (error) throw error

    // 4. Update offer record with DocuSign envelope info
    await supabase.from('offers').update({
      docusign_envelope_id: data.envelopeId,
      docusign_status: 'sent',
      sent_at: new Date().toISOString(),
      template_id: templateId,
    }).eq('id', offerId)

    return data
  }

  const openModal = (name, props = {}) => setModal({ name, props })
  const closeModal = () => setModal(null)

  const activeJobs = jobs.filter(j => j.status === 'Active')
  const activeCandidates = candidates.filter(c =>
    c.applications?.some(a => a.stage !== 'Hired' && a.stage !== 'Rejected')
  )
  const pendingOffers = offers.filter(o => o.status === 'Pending')

  return (
    <AppContext.Provider value={{
      candidates, jobs, interviews, offers, notes, offerTemplates, loading,
      activeJobs, activeCandidates, pendingOffers,
      addCandidate, addJob, updateJobStatus, updateJobPublish,
      moveStage, addApplication, addNote,
      addInterview, addOffer, updateOfferStatus, updateOfferDocuSign,
      uploadOfferTemplate, deleteOfferTemplate, sendOfferViaDocuSign, previewOffer,
      modal, openModal, closeModal,
      user, reload: loadAll,
    }}>
      {children}
    </AppContext.Provider>
  )
}
