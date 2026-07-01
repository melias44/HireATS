import { useState } from 'react'
import { useApp } from '../../context/AppContext'

const ROLE_STYLES = {
  admin:           { bg: '#EEF4FF', color: '#1D4ED8', label: 'Admin' },
  member:          { bg: '#F1F5F9', color: '#475569', label: 'Member' },
  hiring_manager:  { bg: '#FFF7ED', color: '#C2410C', label: 'Hiring Mgr' },
}

export default function Settings() {
  const { team, inviteTeamMember, updateTeamMemberRole, isAdmin, user } = useApp()

  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('member')
  const [inviteName, setInviteName] = useState('')
  const [inviting, setInviting] = useState(false)
  const [inviteError, setInviteError] = useState('')
  const [inviteSuccess, setInviteSuccess] = useState('')

  async function handleInvite() {
    if (!inviteEmail.trim()) { setInviteError('Enter an email address.'); return }
    setInviting(true)
    setInviteError('')
    setInviteSuccess('')
    try {
      await inviteTeamMember(inviteEmail.trim(), inviteRole, inviteName.trim())
      setInviteSuccess(`Invite sent to ${inviteEmail.trim()}!`)
      setInviteEmail('')
      setInviteName('')
      setInviteRole('member')
    } catch (err) {
      setInviteError(err.message || 'Failed to send invite.')
    } finally {
      setInviting(false)
    }
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

      {/* Invite */}
      {isAdmin && (
        <div className="section-card">
          <div className="section-head">
            <span className="section-title">Invite someone</span>
          </div>
          <div style={{ padding: '20px 24px' }}>
            {inviteError && (
              <div style={{ background: 'var(--red-bg)', border: '1px solid #FCA5A5', borderRadius: 'var(--radius)', padding: '8px 12px', fontSize: 13, color: 'var(--red-text)', marginBottom: 14 }}>
                {inviteError}
              </div>
            )}
            {inviteSuccess && (
              <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 'var(--radius)', padding: '8px 12px', fontSize: 13, color: '#15803D', marginBottom: 14 }}>
                {inviteSuccess}
              </div>
            )}
            <div className="form-grid">
              <div className="form-row">
                <label className="form-label">Email address</label>
                <input
                  className="form-input"
                  type="email"
                  placeholder="colleague@company.com"
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
                  { value: 'admin',          label: 'Admin',           desc: '— full access, can invite others' },
                  { value: 'member',         label: 'Member',          desc: '— full access, cannot manage team' },
                  { value: 'hiring_manager', label: 'Hiring Manager',  desc: '— sees only their assigned job and its candidates' },
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
                {inviting ? 'Sending invite…' : 'Send invite'}
              </button>
            </div>
            <div style={{ marginTop: 12, fontSize: 12, color: 'var(--text-3)' }}>
              They'll receive an email with a link to set their password and access the ATS.
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
