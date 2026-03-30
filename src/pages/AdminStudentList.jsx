import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { apiAdminPatchUser, apiAdminUsers } from '../lib/api'

function getRole() {
  try {
    const raw = localStorage.getItem('authUser')
    const user = raw ? JSON.parse(raw) : null
    return user?.role || null
  } catch {
    return null
  }
}

function isUserActive(u) {
  return u?.is_active !== 0 && u?.is_active !== false
}

function formatStudentType(t) {
  if (t === 'irregular') return 'Irregular'
  return 'Regular'
}

function displayStudentId(s) {
  const sid = (s.student_id || '').trim()
  if (sid) return sid
  const legacy = (s.identifier || '').trim()
  if (legacy && !legacy.includes('@')) return legacy
  return '—'
}

function IconEye() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}

function IconUserOff() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <line x1="17" y1="8" x2="22" y2="13" />
      <line x1="22" y1="8" x2="17" y2="13" />
    </svg>
  )
}

export default function AdminStudentList() {
  const location = useLocation()
  const navigate = useNavigate()
  const [students, setStudents] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [createSuccess, setCreateSuccess] = useState('')
  const [search, setSearch] = useState('')
  const [filterSection, setFilterSection] = useState('')
  const [filterType, setFilterType] = useState('')
  const [actionId, setActionId] = useState(null)
  const [deactivateTarget, setDeactivateTarget] = useState(null)

  const isAdmin = getRole() === 'admin'

  async function loadStudents() {
    const token = localStorage.getItem('authToken')
    if (!token) {
      setError('Missing auth token. Please sign in again.')
      setLoading(false)
      return
    }

    setLoading(true)
    setError('')
    try {
      const result = await apiAdminUsers(token)
      const allUsers = Array.isArray(result?.users) ? result.users : []
      setStudents(allUsers.filter((u) => u.role === 'student'))
    } catch (err) {
      setError(err?.message || 'Failed to load students.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!isAdmin) {
      setLoading(false)
      return
    }
    loadStudents()
  }, [isAdmin])

  useEffect(() => {
    if (!location.state?.studentCreated) return
    const id = location.state.createdStudentId
    setCreateSuccess(
      id
        ? `Student account created successfully for ${id}.`
        : 'Student account created successfully.',
    )
    navigate(location.pathname, { replace: true, state: {} })
  }, [location.state?.studentCreated, location.state?.createdStudentId, location.pathname, navigate])

  const sectionOptions = useMemo(() => {
    const set = new Set()
    for (const s of students) {
      const sec = (s.class_section || '').trim()
      if (sec) set.add(sec)
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b))
  }, [students])

  const filteredStudents = useMemo(() => {
    const q = search.trim().toLowerCase()
    return students.filter((s) => {
      if (q) {
        const sid = String(displayStudentId(s)).toLowerCase()
        const mail = String(s.email || '').toLowerCase()
        const legacyId = String(s.identifier || '').toLowerCase()
        const fullName = String(s.full_name || '').toLowerCase()
        if (
          !sid.includes(q) &&
          !mail.includes(q) &&
          !legacyId.includes(q) &&
          !fullName.includes(q)
        ) {
          return false
        }
      }
      if (filterSection === '__none__') {
        if ((s.class_section || '').trim()) return false
      } else if (filterSection) {
        if ((s.class_section || '').trim() !== filterSection) return false
      }
      if (filterType === 'regular' || filterType === 'irregular') {
        const t = (s.student_type || 'regular').toLowerCase()
        if (t !== filterType) return false
      }
      return true
    })
  }, [students, search, filterSection, filterType])

  async function confirmDeactivate() {
    const student = deactivateTarget
    if (!student || !isUserActive(student)) {
      setDeactivateTarget(null)
      return
    }
    const token = localStorage.getItem('authToken')
    if (!token) return
    setActionId(student.id)
    setError('')
    try {
      await apiAdminPatchUser(token, student.id, { isActive: false })
      setDeactivateTarget(null)
      await loadStudents()
    } catch (err) {
      setError(err?.message || 'Failed to deactivate student.')
    } finally {
      setActionId(null)
    }
  }

  if (!isAdmin) {
    return (
      <div className="module-page">
        <p className="empty-state">This page is available for administrators only.</p>
      </div>
    )
  }

  const deactivateSubmitting =
    deactivateTarget != null && actionId != null && actionId === deactivateTarget.id

  return (
    <div className="module-page">
      <header className="module-header">
        <div>
          <h1 className="main-title">1.1 Student List</h1>
          <p className="main-description">
            Filter and manage student accounts. Use Create student account to add new logins.
          </p>
        </div>
        <Link to="/admin/create-student" className="btn btn-primary">
          Create student account
        </Link>
      </header>

      <section className="content-panel">
        <div className="content-header" style={{ flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ flex: '1 1 200px' }}>
            <h2 className="content-title">Students</h2>
            <p className="content-subtitle">Search and filter by class section or regular / irregular status.</p>
          </div>
          <div
            className="search-section"
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '10px',
              alignItems: 'center',
              justifyContent: 'flex-end',
            }}
          >
            <input
              className="search-input"
              type="text"
              placeholder="Search by student ID, name, or email…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ minWidth: '180px' }}
            />
            <select
              className="search-input"
              value={filterSection}
              onChange={(e) => setFilterSection(e.target.value)}
              aria-label="Filter by class section"
              style={{ minWidth: '160px' }}
            >
              <option value="">All sections</option>
              <option value="__none__">No section</option>
              {sectionOptions.map((sec) => (
                <option key={sec} value={sec}>
                  {sec}
                </option>
              ))}
            </select>
            <select
              className="search-input"
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              aria-label="Filter by student type"
              style={{ minWidth: '150px' }}
            >
              <option value="">All types</option>
              <option value="regular">Regular</option>
              <option value="irregular">Irregular</option>
            </select>
          </div>
        </div>

        {createSuccess && (
          <div className="auth-success" style={{ margin: '0 0 12px' }}>
            {createSuccess}
            <button
              type="button"
              className="auth-success-dismiss"
              onClick={() => setCreateSuccess('')}
              aria-label="Dismiss"
            >
              ×
            </button>
          </div>
        )}

        {error && (
          <div className="auth-error" style={{ margin: '0 0 12px' }}>
            {error}
          </div>
        )}

        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Student ID</th>
                <th>Full name</th>
                <th>Section</th>
                <th>Type</th>
                <th>2FA</th>
                <th>Status</th>
                <th>Created</th>
                <th style={{ width: '1%' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan="9" className="empty-state">
                    Loading student accounts…
                  </td>
                </tr>
              )}
              {!loading && filteredStudents.length === 0 && (
                <tr>
                  <td colSpan="9" className="empty-state">
                    No students match the current filters.
                  </td>
                </tr>
              )}
              {!loading &&
                filteredStudents.map((student, index) => {
                  const active = isUserActive(student)
                  const busy = actionId === student.id
                  return (
                    <tr key={student.id}>
                      <td>{index + 1}</td>
                      <td>{displayStudentId(student)}</td>
                      <td>{student.full_name || '—'}</td>
                      <td>{(student.class_section || '').trim() || '—'}</td>
                      <td>{formatStudentType((student.student_type || 'regular').toLowerCase())}</td>
                      <td>
                        <span className={`status-pill ${student.twofa_enabled ? 'status-active' : ''}`}>
                          {student.twofa_enabled ? 'On' : 'Off'}
                        </span>
                      </td>
                      <td>
                        {active ? (
                          <span className="status-pill status-active">Active</span>
                        ) : (
                          <span className="status-pill">Inactive</span>
                        )}
                      </td>
                      <td>{student.created_at ? new Date(student.created_at).toLocaleString() : '—'}</td>
                      <td>
                        <div className="table-actions-inline">
                          <Link
                            to={`/admin/student/${student.id}`}
                            className="table-icon-action"
                            title="View student"
                            aria-label={`View ${displayStudentId(student)}`}
                          >
                            <IconEye />
                          </Link>
                          <button
                            type="button"
                            className="table-icon-action table-icon-action-danger"
                            title="Deactivate account"
                            aria-label={`Deactivate ${displayStudentId(student)}`}
                            disabled={!active || busy}
                            onClick={() => setDeactivateTarget(student)}
                          >
                            {busy ? (
                              <span className="table-icon-spinner" aria-hidden />
                            ) : (
                              <IconUserOff />
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
            </tbody>
          </table>
        </div>
      </section>

      {deactivateTarget && (
        <div
          className="modal-overlay"
          role="presentation"
          onClick={(e) => e.target === e.currentTarget && !deactivateSubmitting && setDeactivateTarget(null)}
        >
          <div className="modal-card" role="dialog" aria-modal="true" aria-labelledby="deactivate-modal-title">
            <h3 className="modal-title" id="deactivate-modal-title">
              Deactivate student account?
            </h3>
            <p className="modal-text">
              <strong>{displayStudentId(deactivateTarget)}</strong>
              {deactivateTarget.full_name ? ` (${deactivateTarget.full_name})` : ''} will no longer be able to sign in.
              Active sessions will stop working on the next request.
            </p>
            <div className="modal-actions">
              <button type="button" className="btn btn-secondary" onClick={() => setDeactivateTarget(null)}>
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary btn-logout-confirm"
                disabled={actionId === deactivateTarget.id}
                onClick={confirmDeactivate}
              >
                {actionId === deactivateTarget.id ? 'Deactivating…' : 'Deactivate account'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
