import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { apiRegister } from '../lib/api'

function getRole() {
  try {
    const raw = localStorage.getItem('authUser')
    const user = raw ? JSON.parse(raw) : null
    return user?.role || null
  } catch {
    return null
  }
}

export default function AdminCreateStudent() {
  const navigate = useNavigate()
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    studentId: '',
    email: '',
    firstName: '',
    middleName: '',
    lastName: '',
    password: '',
    confirmPassword: '',
    classSection: '',
    studentType: 'regular',
  })

  const isAdmin = getRole() === 'admin'

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
    setError('')
  }

  const handleCreate = async (e) => {
    e.preventDefault()
    if (!form.identifier || !form.password || !form.confirmPassword) {
      setError('Identifier, password, and confirm password are required.')
      return
    }
    if (!form.firstName.trim() || !form.lastName.trim()) {
      setError('First name and last name are required.')
      return
    }
    if (form.password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setCreating(true)
    setError('')
    const fullName = [form.firstName, form.middleName, form.lastName]
      .map((s) => s.trim())
      .filter(Boolean)
      .join(' ')

    try {
      await apiRegister({
        role: 'student',
        studentId: form.studentId.trim(),
        email: form.email.trim(),
        password: form.password,
        fullName,
        classSection: form.classSection || undefined,
        studentType: form.studentType,
      })
      navigate('/student-profile', {
        state: {
          studentCreated: true,
          createdStudentId: form.studentId.trim(),
        },
      })
    } catch (err) {
      setError(err?.message || 'Failed to create student account.')
    } finally {
      setCreating(false)
    }
  }

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
          <h1 className="main-title">Create Student Account</h1>
          <p className="main-description">
            Students cannot self-register. Provision credentials here, then return to the{' '}
            <Link to="/student-profile">student list</Link>.
          </p>
        </div>
      </header>

      <section className="content-panel">
        <div className="content-header">
          <div>
            <h2 className="content-title">New student</h2>
            <p className="content-subtitle">Required fields are marked by validation on submit.</p>
          </div>
          <Link to="/student-profile" className="btn btn-secondary">
            Back to list
          </Link>
        </div>
        <form className="auth-form" onSubmit={handleCreate}>
          <label className="auth-field">
            <span className="auth-label">Student ID</span>
            <input
              className="auth-input"
              type="text"
              name="studentId"
              value={form.studentId}
              onChange={handleChange}
              placeholder="e.g. 2026-00001"
              autoComplete="username"
            />
          </label>
          <label className="auth-field">
            <span className="auth-label">Email</span>
            <input
              className="auth-input"
              type="email"
              name="email"
              value={form.email}
              onChange={handleChange}
              placeholder="e.g. student@example.edu"
              autoComplete="email"
            />
          </label>
          <label className="auth-field">
            <span className="auth-label">First Name</span>
            <input
              className="auth-input"
              type="text"
              name="firstName"
              value={form.firstName}
              onChange={handleChange}
              placeholder="e.g. Juan"
              autoComplete="given-name"
            />
          </label>
          <label className="auth-field">
            <span className="auth-label">Middle Name (Optional)</span>
            <input
              className="auth-input"
              type="text"
              name="middleName"
              value={form.middleName}
              onChange={handleChange}
              placeholder="e.g. Santos"
              autoComplete="additional-name"
            />
          </label>
          <label className="auth-field">
            <span className="auth-label">Last Name</span>
            <input
              className="auth-input"
              type="text"
              name="lastName"
              value={form.lastName}
              onChange={handleChange}
              placeholder="e.g. Dela Cruz"
              autoComplete="family-name"
            />
          </label>
          <label className="auth-field">
            <span className="auth-label">Class section (optional)</span>
            <input
              className="auth-input"
              type="text"
              name="classSection"
              value={form.classSection}
              onChange={handleChange}
              placeholder="e.g. 3A, Block B"
            />
          </label>
          <label className="auth-field">
            <span className="auth-label">Regular / Irregular</span>
            <select
              className="auth-input"
              name="studentType"
              value={form.studentType}
              onChange={handleChange}
            >
              <option value="regular">Regular</option>
              <option value="irregular">Irregular</option>
            </select>
          </label>
          <label className="auth-field">
            <span className="auth-label">Password</span>
            <input
              className="auth-input"
              type="password"
              name="password"
              value={form.password}
              onChange={handleChange}
              placeholder="At least 8 characters"
            />
          </label>
          <label className="auth-field">
            <span className="auth-label">Confirm password</span>
            <input
              className="auth-input"
              type="password"
              name="confirmPassword"
              value={form.confirmPassword}
              onChange={handleChange}
              placeholder="Re-enter password"
            />
          </label>

          {error && <div className="auth-error">{error}</div>}

          <button type="submit" className="btn btn-primary auth-submit" disabled={creating}>
            {creating ? 'Creating…' : 'Create student account'}
          </button>
        </form>
      </section>
    </div>
  )
}
