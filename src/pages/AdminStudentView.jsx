import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { apiAdminUser } from '../lib/api'

function getRole() {
  try {
    const raw = localStorage.getItem('authUser')
    const user = raw ? JSON.parse(raw) : null
    return user?.role || null
  } catch {
    return null
  }
}

function formatStudentType(t) {
  if (t === 'irregular') return 'Irregular'
  if (t === 'regular') return 'Regular'
  return '—'
}

function displayStudentId(u) {
  const sid = (u.student_id || '').trim()
  if (sid) return sid
  const leg = (u.identifier || '').trim()
  if (leg && !leg.includes('@')) return leg
  return '—'
}

export default function AdminStudentView() {
  const { id } = useParams()
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const isAdmin = getRole() === 'admin'

  useEffect(() => {
    if (!isAdmin) {
      setLoading(false)
      return
    }
    const token = localStorage.getItem('authToken')
    if (!token) {
      setError('Missing auth token.')
      setLoading(false)
      return
    }
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setError('')
      try {
        const res = await apiAdminUser(token, id)
        const u = res?.user
        if (!u || u.role !== 'student') {
          throw new Error('Student not found.')
        }
        if (!cancelled) setUser(u)
      } catch (e) {
        if (!cancelled) setError(e?.message || 'Failed to load student.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [id, isAdmin])

  if (!isAdmin) {
    return (
      <div className="module-page">
        <p className="empty-state">This page is available for administrators only.</p>
      </div>
    )
  }

  return (
    <div className="module-page">
      <header className="module-header">
        <div>
          <h1 className="main-title">Student details</h1>
          <p className="main-description">Read-only profile information for this account.</p>
        </div>
        <Link to="/student-profile" className="btn btn-secondary">
          Back to list
        </Link>
      </header>

      <section className="content-panel">
        {loading && <p className="empty-state">Loading…</p>}
        {!loading && error && <p className="auth-error">{error}</p>}
        {!loading && !error && user && (
          <dl className="detail-list" style={{ display: 'grid', gap: '12px', maxWidth: '480px' }}>
            <div>
              <dt style={{ fontSize: '12px', opacity: 0.75, marginBottom: '4px' }}>Student ID</dt>
              <dd style={{ margin: 0, fontWeight: 600 }}>{displayStudentId(user)}</dd>
            </div>
            <div>
              <dt style={{ fontSize: '12px', opacity: 0.75, marginBottom: '4px' }}>Email</dt>
              <dd style={{ margin: 0 }}>{(user.email || '').trim() || '—'}</dd>
            </div>
            <div>
              <dt style={{ fontSize: '12px', opacity: 0.75, marginBottom: '4px' }}>Full name</dt>
              <dd style={{ margin: 0 }}>{user.full_name || '—'}</dd>
            </div>
            <div>
              <dt style={{ fontSize: '12px', opacity: 0.75, marginBottom: '4px' }}>Class section</dt>
              <dd style={{ margin: 0 }}>{user.class_section || '—'}</dd>
            </div>
            <div>
              <dt style={{ fontSize: '12px', opacity: 0.75, marginBottom: '4px' }}>Student type</dt>
              <dd style={{ margin: 0 }}>{formatStudentType(user.student_type)}</dd>
            </div>
            <div>
              <dt style={{ fontSize: '12px', opacity: 0.75, marginBottom: '4px' }}>Two-factor</dt>
              <dd style={{ margin: 0 }}>{user.twofa_enabled ? 'Enabled' : 'Disabled'}</dd>
            </div>
            <div>
              <dt style={{ fontSize: '12px', opacity: 0.75, marginBottom: '4px' }}>Status</dt>
              <dd style={{ margin: 0 }}>
                {user.is_active ? (
                  <span className="status-pill status-active">Active</span>
                ) : (
                  <span className="status-pill">Inactive</span>
                )}
              </dd>
            </div>
            <div>
              <dt style={{ fontSize: '12px', opacity: 0.75, marginBottom: '4px' }}>Created</dt>
              <dd style={{ margin: 0 }}>
                {user.created_at ? new Date(user.created_at).toLocaleString() : '—'}
              </dd>
            </div>
          </dl>
        )}
      </section>
    </div>
  )
}
