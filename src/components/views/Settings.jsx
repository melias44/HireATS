import { useState } from 'react'
import { useApp } from '../../context/AppContext'
import { supabase } from '../../lib/supabase'

const ROLE_STYLES = {
  admin:           { bg: '#EEF4FF', color: '#1D4ED8', label: 'Admin' },
  member:          { bg: '#F1F5F9', color: '#475569', label: 'Member' },
  hiring_manager:  { bg: '#FFF7ED', color: '#C2410C', label: 'Hiring Mgr' },
}

const APP_URL = window.location.origin

export default function Settings() {
  const { team, candidates, inviteTeamMember, updateTeamMemberRole, updateCandidateResumeText, isAdmin, user } = useApp()

  // Resume indexing
  const [indexing, setIndexing] = useState(false)
  const [indexLog, setIndexLog] = useState([])

  const unindexed = candidates.filter(c => c.resume_path && !c.resume_text)

  async function handleIndexResumes() {
    if (unindexed.length === 0) return
    setIndexing(true)
    setIndexLog([`Starting — ${unindexed.length} resume(s) to index…`])

    for (let i = 0; i < unindexed.length; i++) {
      const c = unindexed[i]
      const label = `${c.fname} ${c.lname}`
      try {
        const { data: urlData, error: urlErr } = await supabase.storage
          .from('resumes').createSignedUrl(c.resume_path, 120)
        if (urlErr || !urlData?.signedUrl) {
          setIndexLog(l => [...l, `❌ ${label}: failed to get signed URL — ${urlErr?.message || 'no URL'}`])
          continue
        }

        const res = await fetch(urlData.signedUrl)
        if (!res.ok) {
          setIndexLog(l => [...l, `❌ ${label}: download failed (${res.status})`])
          continue
        }

        const blob = await res.blob()
        const arrayBuffer = await blob.arrayBuffer()
        const uint8 = new Uint8Array(arrayBuffer)
        let binary = ''
        uint8.forEach(b => (binary += String.fromCharCode(b)))
        const fileBase64 = btoa(binary)
        const fileType = blob.type || 'application/pdf'

        const { data, error: fnErr } = await supabase.functions.invoke('parse-resume', {
          body: { fileBase64, fileType },
        })

        if (fnErr) {
          setIndexLog(l => [...l, `❌ ${label}: edge function error — ${fnErr.message}`])
          continue
        }
        if (!data?.raw_text) {
          setIndexLog(l => [...l, `⚠️ ${label}: function returned no text — ${JSON.stringify(data)}`])
          continue
        }

        const { error: updateErr } = await supabase
          .from('candidates').update({ resume_text: data.raw_text }).eq('id', c.id)
        if (updateErr) {
          setIndexLog(l => [...l, `❌ ${label}: DB update failed — ${updateErr.message}`])
          continue
        }

        setIndexLog(l => [...l, `✓ ${label} (${i + 1}/${unindexed.length})`])
      } catch (err) {
        setIndexLog(l => [...l, `❌ ${label}: unexpected error — ${err.message}`])
      }
    }

    setIndexLog(l => [...l, 'Done.'])
    setIndexing(false)
  }

  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('member')
  const [inviteName, setInviteName] = useState('')
  const [inviting, setInviting] = useState(false)
  const [inviteError, setInviteError] = useState('')
  const [inviteSuccess, setInviteSuccess] = useState('')
  const [copied, setCopied] = useState(false)

  async function handleInvite() {
    if (!inviteEmail.trim()) { setInviteError('Enter an email address.'); return }
    setInviting(true)
    setInviteError('')
    setInviteSuccess('')
    try {
      await inviteTeamMember(inviteEmail.trim(), inviteRole, inviteName.trim())
      setInviteSuccess(inviteEmail.trim())
      setInviteEmail('')
      setInviteName('')
      setInviteRole('member')
    } catch (err) {
      setInviteError(err.message || 'Failed to add team member.')
    } finally {
      setInviting(false)
    }
  }

  function copyUrl() {
    navigator.clipboard.writeText(APP_URL)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div style={{ maxWidth: 640 }}>
      {/* Team members */}
      <div className="section-card" style={{ marginBottom: 24 }}>
        <div className="section-head">
          <span className="section-title">Team members</span>
        </div>
        <div className="table-wrap">
          {team.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">👤</div>
              <div className="empty-text">No team members yet.</div>
            </div>
          ) : (
            <table>
              <thead>
                <tr><th>Name / Email</th><th>Role</th><th></th></tr>
              </thead>
              <tbody>
                {team.map(m => {
                  const rs = ROLE_STYLES[m.role] || ROLE_STYLES.member
                  const isYou = m.id === user.id
                  return (
                    <tr key={m.id}>
                      <td>
                        <div style={{ fontWeight: 600 }}>{m.full_name || '—'}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-3)' }}>{m.email}</div>
                      </td>
                      <td>
                        <span className="status-pill" style={{ background: rs.bg, color: rs.color }}>
                          {rs.label}
                        </span>
                        {isYou && <span style={{ marginLeft: 6, fontSize: 11, color: 'var(--text-3)' }}>you</span>}
                      </td>
                      <td>
                        {isAdmin && !isYou && (
                          <select
                            className="stage-select"
                            value={m.role}
                            style={{ fontSize: 12 }}
                            onChange={e => updateTeamMemberRole(m.id, e.target.value)}
                          >
                            <option value="admin">Admin</option>
                            <option value="member">Member</option>
                            <option value="hiring_manager">Hiring Manager</option>
                          </select>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Resume search index */}
      <div className="section-card" style={{ marginBottom: 24 }}>
        <div className="section-head">
          <span className="section-title">Resume search index</span>
        </div>
        <div style={{ padding: '16px 24px' }}>
          <div style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 12 }}>
            {unindexed.length === 0
              ? <span style={{ color: '#15803D' }}>✓ All resumes are indexed.</span>
              : <span>{unindexed.length} resume{unindexed.length !== 1 ? 's' : ''} not yet indexed.</span>
            }
          </div>
          <button
            className="btn btn-primary"
            onClick={handleIndexResumes}
            disabled={indexing || unindexed.length === 0}
            style={{ marginBottom: indexLog.length ? 12 : 0 }}
          >
            {indexing ? 'Indexing…' : `Index ${unindexed.length} resume${unindexed.length !== 1 ? 's' : ''}`}
          </button>
          {indexLog.length > 0 && (
            <div style={{
              marginTop: 12, background: 'var(--bg)', border: '1px solid var(--border)',
              borderRadius: 8, padding: '10px 14px', fontSize: 12,
              fontFamily: 'monospace', color: 'var(--text-2)',
              maxHeight: 200, overflowY: 'auto',
              display: 'flex', flexDirection: 'column', gap: 3,
            }}>
              {indexLog.map((line, i) => (
                <div key={i} style={{ color: line.startsWith('❌') ? '#DC2626' : line.startsWith('⚠️') ? '#D97706' : 'inherit' }}>
                  {line}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Add team member */}
      {isAdmin && (
        <div className="section-card">
          <div className="section-head">
            <span className="section-title">Add team member</span>
          </div>
          <div style={{ padding: '20px 24px' }}>
            {inviteError && (
              <div style={{ background: 'var(--red-bg)', border: '1px solid #FCA5A5', borderRadius: 'var(--radius)', padding: '8px 12px', fontSize: 13, color: 'var(--red-text)', marginBottom: 14 }}>
                {inviteError}
              </div>
            )}
            {inviteSuccess && (
              <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 'var(--radius)', padding: '12px 14px', fontSize: 13, color: '#15803D', marginBottom: 14 }}>
                <div style={{ fontWeight: 600, marginBottom: 6 }}>
                  ✓ {inviteSuccess} has been added.
                </div>
                <div style={{ color: '#166534', marginBottom: 10 }}>
                  No email was sent. Share the link below and they can sign in with their BDG Google account.
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <code style={{
                    background: '#DCFCE7', border: '1px solid #BBF7D0',
                    borderRadius: 6, padding: '4px 10px', fontSize: 12,
                    color: '#15803D', flex: 1, overflow: 'hidden',
                    textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>{APP_URL}</code>
                  <button
                    className="btn btn-sm"
                    onClick={copyUrl}
                    style={{ flexShrink: 0 }}
                  >
                    {copied ? '✓ Copied' : 'Copy link'}
                  </button>
                </div>
              </div>
            )}
            <div className="form-grid">
              <div className="form-row">
                <label className="form-label">Email address</label>
                <input
                  className="form-input"
                  type="email"
                  placeholder="colleague@bustle.com"
                  value={inviteEmail}
                  onChange={e => setInviteEmail(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleInvite()}
                />
              </div>
              <div className="form-row">
                <label className="form-label">Full name <span style={{ color: 'var(--text-3)', fontWeight: 400 }}>(optional)</span></label>
                <input
                  className="form-input"
                  placeholder="Jane Smith"
                  value={inviteName}
                  onChange={e => setInviteName(e.target.value)}
                />
              </div>
            </div>
            <div className="form-row" style={{ marginTop: 12 }}>
              <label className="form-label">Role</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[
                  { value: 'admin',          label: 'Admin',          desc: '— full access, can add team members' },
                  { value: 'member',         label: 'Member',         desc: '— full access, cannot manage team' },
                  { value: 'hiring_manager', label: 'Hiring Manager', desc: '— sees only their assigned job and its candidates' },
                ].map(r => (
                  <label key={r.value} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 13 }}>
                    <input
                      type="radio"
                      name="role"
                      value={r.value}
                      checked={inviteRole === r.value}
                      onChange={() => setInviteRole(r.value)}
                    />
                    <span style={{ fontWeight: 600 }}>{r.label}</span>
                    <span style={{ color: 'var(--text-3)' }}>{r.desc}</span>
                  </label>
                ))}
              </div>
            </div>
            <div style={{ marginTop: 20 }}>
              <button
                className="btn btn-primary"
                onClick={handleInvite}
                disabled={inviting || !inviteEmail.trim()}
              >
                {inviting ? 'Adding…' : 'Add to HireME'}
              </button>
            </div>
            <div style={{ marginTop: 12, fontSize: 12, color: 'var(--text-3)' }}>
              No email will be sent. After adding, share the app link and they sign in with their BDG Google account.
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
