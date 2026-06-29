import { useApp, avColor } from '../../context/AppContext'

export default function Schedule({ onNavigate }) {
  const { interviews, openModal } = useApp()

  const sorted = [...interviews].sort((a, b) => new Date(a.scheduled_at) - new Date(b.scheduled_at))

  const now = new Date()
  const today = new Date(now); today.setHours(0, 0, 0, 0)
  const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1)
  const nextWeek = new Date(today); nextWeek.setDate(today.getDate() + 7)

  const interviewsToday = sorted.filter(i => {
    if (!i.scheduled_at) return false
    const d = new Date(i.scheduled_at); d.setHours(0, 0, 0, 0)
    return d.getTime() === today.getTime()
  })
  const interviewsThisWeek = sorted.filter(i => {
    if (!i.scheduled_at) return false
    const d = new Date(i.scheduled_at)
    return d >= today && d < nextWeek
  })
  const pending = sorted.filter(i => !i.scheduled_at)

  function formatDate(isoStr) {
    if (!isoStr) return '—'
    const d = new Date(isoStr)
    const dd = new Date(d); dd.setHours(0, 0, 0, 0)
    if (dd.getTime() === today.getTime()) return 'Today'
    if (dd.getTime() === tomorrow.getTime()) return 'Tomorrow'
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }
  function formatTime(isoStr) {
    if (!isoStr) return 'TBD'
    return new Date(isoStr).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  }

  return (
    <div>
      <div className="metrics" style={{ gridTemplateColumns: 'repeat(3,1fr)' }}>
        <div className="metric-card"><div className="metric-label">Today</div><div className="metric-value">{interviewsToday.length}</div><div className="metric-sub">Interviews scheduled</div></div>
        <div className="metric-card"><div className="metric-label">This week</div><div className="metric-value">{interviewsThisWeek.length}</div><div className="metric-sub">Total interviews</div></div>
        <div className="metric-card"><div className="metric-label">Total</div><div className="metric-value">{sorted.length}</div><div className="metric-sub">All time</div></div>
      </div>

      <div className="section-card">
        <div className="section-head">
          <span className="section-title">Interview schedule</span>
          <button className="btn btn-sm" onClick={() => openModal('scheduleInterview')}>+ Schedule interview</button>
        </div>
        <div style={{ padding: 18 }} className="schedule-grid">
          {sorted.length === 0 ? (
            <div className="empty-state"><div className="empty-icon">📅</div><div className="empty-text">No interviews scheduled yet.</div></div>
          ) : sorted.map(i => {
            const a = avColor(i.candidate_name || '')
            return (
              <div key={i.id} className="sched-item">
                <div className="sched-time">
                  <div style={{ fontWeight: 600 }}>{formatTime(i.scheduled_at)}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{formatDate(i.scheduled_at)}</div>
                </div>
                <div className="sched-info">
                  <div className="sched-name">{i.candidate_name}</div>
                  <div className="sched-role">{i.job_title}{i.interviewer ? ` · ${i.interviewer}` : ''}</div>
                </div>
                <span className="sched-type" style={{ background: a.bg, color: a.color }}>{i.interview_type}</span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
