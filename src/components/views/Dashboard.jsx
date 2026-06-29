import { useApp, avColor, initials, stageStyle, primaryApp, daysAgo } from '../../context/AppContext'

export default function Dashboard({ onNavigate }) {
  const { candidates, jobs, interviews, offers, activeCandidates, pendingOffers, openModal } = useApp()

  const recent = [...candidates]
    .filter(c => c.applications?.length > 0)
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, 6)

  const upcomingInterviews = interviews
    .filter(i => i.scheduled_at && new Date(i.scheduled_at) >= new Date())
    .sort((a, b) => new Date(a.scheduled_at) - new Date(b.scheduled_at))
    .slice(0, 4)

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1)
  const nextWeek = new Date(today); nextWeek.setDate(today.getDate() + 7)

  const interviewsToday = interviews.filter(i => {
    if (!i.scheduled_at) return false
    const d = new Date(i.scheduled_at); d.setHours(0, 0, 0, 0)
    return d.getTime() === today.getTime()
  }).length

  const interviewsThisWeek = interviews.filter(i => {
    if (!i.scheduled_at) return false
    const d = new Date(i.scheduled_at)
    return d >= today && d < nextWeek
  }).length

  function formatInterviewDate(isoStr) {
    if (!isoStr) return '—'
    const d = new Date(isoStr)
    const t = new Date(); t.setHours(0, 0, 0, 0)
    const tomorrow = new Date(t); tomorrow.setDate(t.getDate() + 1)
    d.setSeconds(0, 0)
    const dDay = new Date(d); dDay.setHours(0, 0, 0, 0)
    if (dDay.getTime() === t.getTime()) return 'Today'
    if (dDay.getTime() === tomorrow.getTime()) return 'Tomorrow'
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }
  function formatTime(isoStr) {
    if (!isoStr) return ''
    return new Date(isoStr).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  }

  const av = (c) => avColor(c.fname)

  return (
    <div>
      <div className="metrics">
        <div className="metric-card">
          <div className="metric-label">Active candidates</div>
          <div className="metric-value">{activeCandidates.length}</div>
          <div className="metric-sub">In pipeline</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Open roles</div>
          <div className="metric-value">{jobs.filter(j => j.status === 'Active').length}</div>
          <div className="metric-sub">Across {new Set(jobs.filter(j => j.status === 'Active').map(j => j.dept)).size} departments</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Interviews this week</div>
          <div className="metric-value">{interviewsThisWeek}</div>
          <div className="metric-sub">{interviewsToday} today</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Offers pending</div>
          <div className="metric-value">{pendingOffers.length}</div>
          <div className="metric-sub">Awaiting response</div>
        </div>
      </div>

      <div className="section-card">
        <div className="section-head">
          <span className="section-title">Recent candidates</span>
          <button className="btn btn-sm" onClick={() => onNavigate('pipeline')}>View pipeline →</button>
        </div>
        <div className="table-wrap">
          {recent.length === 0 ? (
            <div className="empty-state"><div className="empty-icon">👤</div><div className="empty-text">No candidates yet — add one to get started.</div></div>
          ) : (
            <table>
              <thead>
                <tr><th>Candidate</th><th>Role</th><th>Stage</th><th>Source</th><th>Added</th><th></th></tr>
              </thead>
              <tbody>
                {recent.map(c => {
                  const app = primaryApp(c)
                  const a = av(c)
                  const sc = app ? stageStyle(app.stage) : {}
                  return (
                    <tr key={c.id} style={{ cursor: 'pointer' }} onClick={() => openModal('candidateDetail', { candidateId: c.id })}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div className="avatar" style={{ width: 32, height: 32, fontSize: 12, background: a.bg, color: a.color }}>{initials(c.fname, c.lname)}</div>
                          <div>
                            <div style={{ fontWeight: 600 }}>{c.fname} {c.lname}</div>
                            <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{c.email}</div>
                          </div>
                        </div>
                      </td>
                      <td>
                        {app?.role || '—'}
                        {c.applications.length > 1 && (
                          <span style={{ fontSize: 11, color: 'var(--accent-text)', background: 'var(--accent-bg)', borderRadius: 20, padding: '1px 7px', marginLeft: 6 }}>+{c.applications.length - 1} more</span>
                        )}
                      </td>
                      <td>{app && <span className="status-pill" style={{ background: sc.bg, color: sc.color }}>{app.stage}</span>}</td>
                      <td>{c.source}</td>
                      <td>{daysAgo(c.created_at)}</td>
                      <td><button className="btn btn-sm" onClick={e => { e.stopPropagation(); openModal('candidateDetail', { candidateId: c.id }) }}>View</button></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div className="section-card">
        <div className="section-head">
          <span className="section-title">Upcoming interviews</span>
          <button className="btn btn-sm" onClick={() => openModal('scheduleInterview')}>+ Schedule</button>
        </div>
        <div style={{ padding: 16 }} className="schedule-grid">
          {upcomingInterviews.length === 0 ? (
            <div className="empty-state" style={{ padding: '24px' }}><div className="empty-text">No interviews scheduled.</div></div>
          ) : upcomingInterviews.map(i => {
            const a = avColor(i.candidate_name || '')
            return (
              <div key={i.id} className="sched-item">
                <div className="sched-time">{formatTime(i.scheduled_at)}</div>
                <div className="sched-info">
                  <div className="sched-name">{i.candidate_name}</div>
                  <div className="sched-role">{i.job_title}</div>
                </div>
                <span className="sched-type" style={{ background: a.bg, color: a.color }}>{i.interview_type}</span>
                <span style={{ fontSize: 11, color: 'var(--text-3)', marginLeft: 8 }}>{formatInterviewDate(i.scheduled_at)}</span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
