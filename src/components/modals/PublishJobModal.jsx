import { useState } from 'react'
import { useApp } from '../../context/AppContext'

export default function PublishJobModal({ jobId, onClose }) {
  const { jobs, updateJobPublish } = useApp()
  const job = jobs.find(j => j.id === jobId)
  const [doCareers, setDoCareers] = useState(true)
  const [doLinkedIn, setDoLinkedIn] = useState(true)
  const [published, setPublished] = useState(false)
  const [results, setResults] = useState([])
  const [saving, setSaving] = useState(false)

  if (!job) return null

  async function handlePublish() {
    setSaving(true)
    const updates = {}
    const msgs = []

    if (doCareers) {
      updates.careers_published = true
      updates.status = 'Active'
      msgs.push('✓ Published to your careers page')
    }
    if (doLinkedIn) {
      updates.linkedin_published = true
      msgs.push('↗ LinkedIn tab opening — review and confirm to post')
    }

    if (Object.keys(updates).length) {
      await updateJobPublish(jobId, updates)
    }

    if (doLinkedIn) {
      const desc = `${job.title} at our company\n\nDepartment: ${job.dept}\nLocation: ${job.location}\nType: ${job.employment_type}\nSalary: ${job.salary}\n\nWe are hiring a ${job.title}. Apply via our careers page.`
      const params = new URLSearchParams({
        jobPostingTitle: job.title,
        jobPostingDescription: desc,
        jobPostingEmploymentStatus: job.employment_type === 'Full-time' ? 'F' : 'P',
      })
      setTimeout(() => window.open(`https://www.linkedin.com/talent/job-postings/new?${params}`, '_blank'), 400)
    }

    setResults(msgs)
    setPublished(true)
    setSaving(false)
  }

  return (
    <div className="modal-backdrop open" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal" style={{ width: 500 }}>
        <div className="modal-head">
          <div>
            <div className="modal-title">Publish job posting</div>
            <div className="modal-sub">{job.dept} · {job.location} · {job.employment_type}</div>
          </div>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '14px 16px', marginBottom: 18 }}>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>{job.title}</div>
            <div style={{ fontSize: 13, color: 'var(--text-3)' }}>{job.salary}</div>
          </div>

          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-2)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Publish to</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 14, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '14px 16px', cursor: 'pointer' }}>
              <input type="checkbox" checked={doCareers} onChange={e => setDoCareers(e.target.checked)} style={{ width: 16, height: 16, accentColor: 'var(--accent)' }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 2 }}>Careers page</div>
                <div style={{ fontSize: 12, color: 'var(--text-3)' }}>Goes live on your public careers site immediately</div>
              </div>
              {job.careers_published && <span style={{ color: 'var(--green-text)', fontWeight: 500, fontSize: 12 }}>✓ Live</span>}
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 14, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '14px 16px', cursor: 'pointer' }}>
              <input type="checkbox" checked={doLinkedIn} onChange={e => setDoLinkedIn(e.target.checked)} style={{ width: 16, height: 16, accentColor: '#0A66C2' }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 2 }}>LinkedIn Jobs</div>
                <div style={{ fontSize: 12, color: 'var(--text-3)' }}>Opens LinkedIn with job details pre-filled — confirm to post</div>
              </div>
              {job.linkedin_published && <span style={{ color: '#0A66C2', fontWeight: 500, fontSize: 12 }}>✓ Posted</span>}
            </label>
          </div>

          <div style={{ background: 'var(--amber-bg)', border: '1px solid #FDE68A', borderRadius: 'var(--radius)', padding: '11px 14px', fontSize: 12, color: 'var(--amber-text)', marginBottom: 16 }}>
            <strong>LinkedIn note:</strong> Direct API posting requires LinkedIn partner approval. This option opens LinkedIn with your job pre-filled — you review and confirm before it goes live.
          </div>

          {published && results.length > 0 && (
            <div style={{ background: 'var(--green-bg)', border: '1px solid #BBF7D0', borderRadius: 'var(--radius)', padding: '12px 14px' }}>
              {results.map((r, i) => <div key={i} style={{ fontSize: 13, color: 'var(--green-text)', padding: '3px 0' }}>{r}</div>)}
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn" onClick={onClose}>Close</button>
          {!published && (
            <button className="btn btn-primary" onClick={handlePublish} disabled={saving || (!doCareers && !doLinkedIn)}>
              {saving ? 'Publishing…' : 'Publish now'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
