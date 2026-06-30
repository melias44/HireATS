import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useApp } from '../context/AppContext'
import Dashboard from './views/Dashboard'
import Pipeline from './views/Pipeline'
import Jobs from './views/Jobs'
import Schedule from './views/Schedule'
import Offers from './views/Offers'
import Reports from './views/Reports'
import Settings from './views/Settings'
import AddCandidateModal from './modals/AddCandidateModal'
import AddJobModal from './modals/AddJobModal'
import CandidateDetailModal from './modals/CandidateDetailModal'
import ScheduleInterviewModal from './modals/ScheduleInterviewModal'
import GenerateOfferModal from './modals/GenerateOfferModal'
import PublishJobModal from './modals/PublishJobModal'
import AddApplicationModal from './modals/AddApplicationModal'

const VIEWS = {
  dashboard: { label: 'Dashboard', component: Dashboard },
  pipeline: { label: 'Candidate pipeline', component: Pipeline },
  jobs: { label: 'Job postings', component: Jobs },
  schedule: { label: 'Interview schedule', component: Schedule },
  offers: { label: 'Offer letters', component: Offers },
  reports: { label: 'Reports & analytics', component: Reports },
  settings: { label: 'Settings', component: Settings },
}

export default function Layout() {
  const [view, setView] = useState('dashboard')
  const { activeCandidates, activeJobs, pendingOffers, modal, openModal, closeModal, user } = useApp()

  const ViewComponent = VIEWS[view]?.component || Dashboard

  return (
    <>
      <nav className="sidebar">
        <div className="sidebar-logo">
          <div className="logo-mark">Hire<span>.</span></div>
          <div className="logo-sub">Applicant Tracking System</div>
        </div>
        <div className="sidebar-nav">
          <div className="nav-section">Recruiting</div>
          <NavItem icon={<GridIcon />} label="Dashboard" active={view === 'dashboard'} onClick={() => setView('dashboard')} />
          <NavItem icon={<PipelineIcon />} label="Pipeline" active={view === 'pipeline'} onClick={() => setView('pipeline')} badge={activeCandidates.length || null} />
          <NavItem icon={<BriefcaseIcon />} label="Job postings" active={view === 'jobs'} onClick={() => setView('jobs')} badge={activeJobs.length || null} />
          <NavItem icon={<CalendarIcon />} label="Interviews" active={view === 'schedule'} onClick={() => setView('schedule')} />
          <div className="nav-section">Outcomes</div>
          <NavItem icon={<DocIcon />} label="Offers" active={view === 'offers'} onClick={() => setView('offers')} badge={pendingOffers.length || null} />
          <NavItem icon={<ChartIcon />} label="Reports" active={view === 'reports'} onClick={() => setView('reports')} />
          <div className="nav-section">Admin</div>
          <NavItem icon={<SettingsIcon />} label="Settings" active={view === 'settings'} onClick={() => setView('settings')} />
        </div>
        <div className="sidebar-footer">
          <span className="realtime-dot" title="Live sync active" />
          {user.email}
          <button
            onClick={() => supabase.auth.signOut()}
            style={{ float: 'right', background: 'none', border: 'none', color: 'var(--text-3)', cursor: 'pointer', fontSize: 11 }}
          >
            Sign out
          </button>
        </div>
      </nav>

      <div className="main">
        <div className="topbar">
          <div className="topbar-title">{VIEWS[view]?.label}</div>
          <div className="topbar-actions">
            <button className="btn btn-sm" onClick={() => openModal('addCandidate')}>+ Add candidate</button>
            <button className="btn btn-sm btn-primary" onClick={() => openModal('addJob')}>+ New job</button>
          </div>
        </div>
        <div className="content">
          <ViewComponent onNavigate={setView} />
        </div>
      </div>

      {/* Modals */}
      {modal?.name === 'addCandidate' && <AddCandidateModal onClose={closeModal} />}
      {modal?.name === 'addJob' && <AddJobModal onClose={closeModal} onCreated={id => openModal('publishJob', { jobId: id })} />}
      {modal?.name === 'candidateDetail' && <CandidateDetailModal candidateId={modal.props.candidateId} onClose={closeModal} />}
      {modal?.name === 'scheduleInterview' && <ScheduleInterviewModal onClose={closeModal} />}
      {modal?.name === 'generateOffer' && <GenerateOfferModal onClose={closeModal} />}
      {modal?.name === 'publishJob' && <PublishJobModal jobId={modal.props.jobId} onClose={closeModal} />}
      {modal?.name === 'addApplication' && <AddApplicationModal candidateId={modal.props.candidateId} onClose={closeModal} />}
    </>
  )
}

function NavItem({ icon, label, active, onClick, badge }) {
  return (
    <div className={`nav-item${active ? ' active' : ''}`} onClick={onClick}>
      {icon}
      {label}
      {badge != null && <span className="nav-badge">{badge}</span>}
    </div>
  )
}

// Icons
function GridIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
}
function PipelineIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2v-4M9 21H5a2 2 0 01-2-2v-4m0 0h18"/></svg>
}
function BriefcaseIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2"/></svg>
}
function CalendarIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>
}
function DocIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
}
function ChartIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
}
function SettingsIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>
}
