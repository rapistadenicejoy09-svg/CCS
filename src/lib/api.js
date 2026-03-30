const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:5000'

async function request(path, options = {}) {
  const { headers: optionHeaders, ...rest } = options
  let res
  try {
    res = await fetch(`${API_BASE}${path}`, {
      ...rest,
      headers: {
        'Content-Type': 'application/json',
        ...(optionHeaders || {}),
      },
    })
  } catch (e) {
    const err = new Error(
      `Unable to reach API server at ${API_BASE}. Is the backend running?`,
    )
    err.cause = e
    throw err
  }

  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const msg = data?.error || 'Request failed'
    const err = new Error(msg)
    err.status = res.status
    err.data = data
    throw err
  }
  return data
}

export async function apiRegister({
  role,
  identifier,
  password,
  fullName,
  enable2FA,
  classSection,
  studentType,
  studentId,
  email,
}) {
  return request('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      role,
      identifier,
      password,
      fullName,
      enable2FA,
      classSection,
      studentType,
      studentId,
      email,
    }),
  })
}

export async function apiLogin({ identifier, password, twoFACode }) {
  return request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ identifier, password, twoFACode }),
  })
}

export async function apiLogout(token) {
  return request('/api/auth/logout', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  })
}

export async function apiMe(token) {
  return request('/api/me', {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  })
}

export async function apiAdminUsers(token) {
  return request('/api/admin/users', {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  })
}

export async function apiAdminUser(token, id) {
  return request(`/api/admin/users/${id}`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  })
}

export async function apiAdminPatchUser(token, id, body) {
  return request(`/api/admin/users/${id}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  })
}

