import { useEffect, useState, useRef } from 'react'
import { NavLink, Outlet, Link, useNavigate } from 'react-router-dom'
import { getAllowedModules } from './lib/security'

const ALL_MODULES = [
  { id: 'student-profile', code: '1.1', title: 'Student List', path: '/student-profile' },
  { id: 'faculty-profile', code: '1.2', title: 'Faculty Profile', path: '/faculty-profile' },
  { id: 'events', code: '1.3', title: 'Events', path: '/events' },
  { id: 'scheduling', code: '1.4', title: 'Scheduling', path: '/scheduling' },
  { id: 'college-research', code: '1.5', title: 'College Research', path: '/college-research' },
  { id: 'instructions', code: '1.6', title: 'Instructions', path: '/instructions' },
]

export default function Layout() {
  const [modules, setModules] = useState([])
  const [theme, setTheme] = useState('light')
  const [userLabel, setUserLabel] = useState('')
  const [headerRoleLabel, setHeaderRoleLabel] = useState('')
  const [profilePath, setProfilePath] = useState(null)
  const [showLogoutModal, setShowLogoutModal] = useState(false)
  const navigate = useNavigate()

  const [showNotifications, setShowNotifications] = useState(false)
  const [notifications, setNotifications] = useState([
    { id: 1, title: 'Profile Reviewed', message: 'Your student profile has been approved.', isRead: false },
    { id: 2, title: 'System Update', message: 'Scheduled maintenance this Saturday.', isRead: false },
    { id: 3, title: 'Welcome', message: 'Welcome to the new CCS Dashboard.', isRead: true },
  ])
  const notifRef = useRef(null)

  const unreadCount = notifications.filter(n => !n.isRead).length

  useEffect(() => {
    function handleClickOutside(event) {
      if (notifRef.current && !notifRef.current.contains(event.target)) {
        setShowNotifications(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  function markAllRead() {
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })))
  }

  function markAsRead(id) {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n))
  }

  useEffect(() => {
    document.body.dataset.theme = theme
    let label = ''
    let role = null

    let path = null
    try {
      const raw = localStorage.getItem('authUser')
      const parsed = raw ? JSON.parse(raw) : null
      role = parsed?.role || null
      if (parsed?.role === 'admin') {
        label = `Admin: ${parsed.fullName || parsed.identifier || ''}`.trim()
        path = '/admin-profile'
        setHeaderRoleLabel('Admin')
      } else if (parsed?.role === 'student') {
        label = `Student: ${parsed.studentId || parsed.identifier || ''}`.trim()
        path = '/student-profile'
        setHeaderRoleLabel('Student')
      } else if (parsed?.role === 'faculty') {
        label = `Faculty: ${parsed.identifier || ''}`.trim()
        path = '/faculty-my-profile'
        setHeaderRoleLabel('Faculty')
      } else {
        setHeaderRoleLabel('')
      }
    } catch {
      setHeaderRoleLabel('')
    }

    setUserLabel(label)
    setProfilePath(path)
    const roleAwareModules = ALL_MODULES.map((m) => {
      if (m.id === 'student-profile') {
        return { ...m, title: role === 'admin' ? 'Student List' : 'Student Profile' }
      }
      return m
    })
    setModules(getAllowedModules(roleAwareModules))
  }, [theme])

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="sidebar-branding-grid">
            <img src="/ccs_logo.png" alt="Logo" className="sidebar-main-logo" />
            <div className="sidebar-titles">
              <h1 className="sidebar-main-title">CCS <span className="pinnacle-accent">Profiling</span></h1>
              <h2 className="sidebar-sub-title">College of Computing Studies</h2>
              <p className="sidebar-tag-title">Comprehensive Profiling System</p>
            </div>
          </div>
        </div>
        
        <div className="sidebar-semester-wrapper">
          {(() => {
            const now = new Date();
            const year = now.getFullYear();
            const month = now.getMonth(); // 0 is Jan, 11 is Dec
            const isSecondSemester = month >= 1 && month <= 6; // roughly Feb-July
            const academicYear = isSecondSemester ? `${year - 1}-${year}` : `${year}-${year + 1}`;
            const currentTerm = isSecondSemester ? "Second Semester" : "First Semester";
            
            return (
              <div className="sidebar-semester-card">
                <div className="semester-text">{currentTerm}</div>
                <div className="ay-text">A.Y. {academicYear}</div>
              </div>
            );
          })()}
        </div>

        <nav className="sidebar-nav">
          <NavLink
            to="/"
            end
            className={({ isActive }) => 'nav-item' + (isActive ? ' nav-item-active' : '')}
          >
             <svg className="nav-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>
             My Dashboard
          </NavLink>
          {modules.map((m) => (
            <NavLink
              key={m.id}
              to={m.path}
              className={({ isActive }) => 'nav-item' + (isActive ? ' nav-item-active' : '')}
            >
              <svg className="nav-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
              {m.title}
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer">
          <button
              type="button"
              className="btn btn-secondary btn-compact logout-btn-full"
              onClick={() => setShowLogoutModal(true)}
            >
              Log out
          </button>
        </div>
      </aside>

      <main className="main">
        <div className="main-top-bar">
          <div className="top-bar-user-info">
            <span className="top-bar-name">
              {userLabel ? userLabel.split(':')[1]?.trim() || userLabel : 'USER'}
            </span>
            {headerRoleLabel ? (
              <span className="top-bar-role badge-enrolled">{headerRoleLabel}</span>
            ) : null}
          </div>
          <div className="top-bar-actions" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <button
              type="button"
              className="notification-icon-btn"
              onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
              title="Toggle Theme"
            >
              {theme === 'light' ? (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>
              )}
            </button>
            <div className="notification-bell" ref={notifRef}>
              <button 
                className="notification-icon-btn" 
                onClick={() => setShowNotifications(!showNotifications)}
                title="Notifications"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>
                {unreadCount > 0 && <span className="notification-badge">{unreadCount}</span>}
              </button>
              
              {showNotifications && (
                <div className="notification-dropdown">
                  <div className="notif-header">
                    <h4>Notifications</h4>
                    {unreadCount > 0 && (
                      <button className="notif-mark-read" onClick={markAllRead}>
                        Mark all as read
                      </button>
                    )}
                  </div>
                  <div className="notif-list">
                    {notifications.length === 0 ? (
                      <div className="notif-empty">No notifications</div>
                    ) : (
                      notifications.map(n => (
                        <div 
                          key={n.id} 
                          className={`notif-item ${!n.isRead ? 'unread' : ''}`}
                          onClick={() => markAsRead(n.id)}
                        >
                          <div className="notif-item-title">{n.title} {!n.isRead && <span className="notif-dot"></span>}</div>
                          <div className="notif-item-msg">{n.message}</div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
            {profilePath ? (
              <Link to={profilePath} className="top-bar-avatar" title="Go to Profile">
                <div className="avatar-placeholder">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                </div>
              </Link>
            ) : (
              <div className="top-bar-avatar">
                <div className="avatar-placeholder">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                </div>
              </div>
            )}
          </div>
        </div>
        
        <div className="main-content-scrollable">
          <Outlet />
        </div>
      </main>

      {showLogoutModal && (
        <div className="modal-overlay">
          <div className="modal-card">
            <h3 className="modal-title">Confirm Logout</h3>
            <p className="modal-text">Are you sure you want to log out of your account?</p>
            <div className="modal-actions">
              <button 
                className="btn btn-secondary" 
                onClick={() => setShowLogoutModal(false)}
              >
                Cancel
              </button>
              <button 
                className="btn btn-primary btn-logout-confirm" 
                onClick={() => {
                  let loginPath = '/admin/login'
                  try {
                    const raw = localStorage.getItem('authUser')
                    const u = raw ? JSON.parse(raw) : null
                    if (u?.role === 'student') loginPath = '/student/login'
                    else if (u?.role === 'faculty') loginPath = '/faculty/login'
                    else if (u?.role === 'admin') loginPath = '/admin/login'
                  } catch {
                    // keep default
                  }
                  localStorage.removeItem('authToken')
                  localStorage.removeItem('authUser')
                  navigate(loginPath, { replace: true })
                }}
              >
                Log out
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
