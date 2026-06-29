import { useApp, STAGES, COLORS } from '../../context/AppContext'

function BarChart({ data, maxVal }) {
  return (
    <div className="chart-bar-wrap">
      {data.map((item, i) => (
        <div key={item.label} className="bar-row">
          <div className="bar-label" style={{ fontSize: 11 }}>{item.label}</div>
          <div className="bar-track">
            <div
              className="bar-fill"
              style={{
                width: maxVal > 0 ? `${Math.round(item.val / maxVal * 100)}%` : '0%',
                background: COLORS[i % COLORS.length],
              }}
            >
              {item.val > 0 ? item.val : ''}
            </div>
          </div>
          <div className="bar-val">{item.label.endsWith('d') ? item.val + 'd' : item.val}</div>
        </div>
      ))}
    </div>
  )
}

export default function Reports() {
  const { candidates, jobs, offers } = useApp()

  const allApps = candidates.flatMap(c => c.applications || [])

  // Stage distribution
  const stageCounts = STAGES.map(s => ({ label: s, val: allApps.filter(a => a.stage === s).length }))
  const maxStage = Math.max(...stageCounts.map(x => x.val), 1)

  // Source distribution
  const sourceCounts = {}
  candidates.forEach(c => { sourceCounts[c.source] = (sourceCounts[c.source] || 0) + 1 })
  const sources = Object.entries(sourceCounts).sort((a, b) => b[1] - a[1]).map(([l, v]) => ({ label: l, val: v }))
  const maxSrc = Math.max(...sources.map(x => x.val), 1)

  // Candidates by role (job title)
  const roleCounts = {}
  allApps.forEach(a => {
    const title = a.role || jobs.find(j => j.id === a.job_id)?.title || 'Unknown'
    roleCounts[title] = (roleCounts[title] || 0) + 1
  })
  const roles = Object.entries(roleCounts).sort((a, b) => b[1] - a[1]).map(([l, v]) => ({ label: l, val: v }))
  const maxRole = Math.max(...roles.map(x => x.val), 1)

  // Offer stats
  const accepted = offers.filter(o => o.status === 'Accepted').length
  const total = offers.length
  const acceptRate = total > 0 ? Math.round(accepted / total * 100) : 0

  const hired = allApps.filter(a => a.stage === 'Hired').length
  const convRate = allApps.length > 0 ? ((hired / allApps.length) * 100).toFixed(1) : 0

  // Dept placeholder (no actual date tracking yet)
  const deptData = [
    { label: 'Engineering', val: 22 },
    { label: 'Product', val: 19 },
    { label: 'Design', val: 16 },
    { label: 'Marketing', val: 14 },
  ]

  return (
    <div>
      <div className="metrics">
        <div className="metric-card">
          <div className="metric-label">Total applicants</div>
          <div className="metric-value">{candidates.length}</div>
          <div className="metric-sub">All time</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Offer acceptance rate</div>
          <div className="metric-value">{acceptRate}%</div>
          <div className="metric-sub">Industry avg 72%</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Active jobs</div>
          <div className="metric-value">{jobs.filter(j => j.status === 'Active').length}</div>
          <div className="metric-sub">of {jobs.length} total</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Pipeline conversion</div>
          <div className="metric-value">{convRate}%</div>
          <div className="metric-sub">Applied → hired</div>
        </div>
      </div>

      <div className="report-grid">
        <div className="section-card">
          <div className="section-head"><span className="section-title">Candidates by stage</span></div>
          <div style={{ padding: 18 }}>
            <BarChart data={stageCounts} maxVal={maxStage} />
          </div>
        </div>
        <div className="section-card">
          <div className="section-head"><span className="section-title">Sources</span></div>
          <div style={{ padding: 18 }}>
            {sources.length === 0
              ? <div style={{ color: 'var(--text-3)', fontSize: 13 }}>No data yet.</div>
              : <BarChart data={sources} maxVal={maxSrc} />}
          </div>
        </div>
        <div className="section-card">
          <div className="section-head"><span className="section-title">Candidates by role</span></div>
          <div style={{ padding: 18 }}>
            {roles.length === 0
              ? <div style={{ color: 'var(--text-3)', fontSize: 13 }}>No data yet.</div>
              : <BarChart data={roles} maxVal={maxRole} />}
          </div>
        </div>
        <div className="section-card">
          <div className="section-head"><span className="section-title">Time to hire by dept (days)</span></div>
          <div style={{ padding: 18 }}>
            <BarChart data={deptData} maxVal={Math.max(...deptData.map(x => x.val))} />
            <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 10 }}>Placeholder data — will auto-calculate from applied_at → hired date once candidates move through.</div>
          </div>
        </div>
      </div>
    </div>
  )
}
