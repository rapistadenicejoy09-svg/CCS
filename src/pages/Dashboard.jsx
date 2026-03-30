import { useMemo, useState, useEffect } from 'react'
import { Link } from 'react-router-dom'

const MODULES = [
  { id: 'student-profile', code: '1.1', title: 'Student List', path: '/student-profile' },
  { id: 'faculty-profile', code: '1.2', title: 'Faculty Profile', path: '/faculty-profile' },
  { id: 'events', code: '1.3', title: 'Events', path: '/events' },
  { id: 'scheduling', code: '1.4', title: 'Scheduling', path: '/scheduling' },
  { id: 'college-research', code: '1.5', title: 'College Research', path: '/college-research' },
  { id: 'instructions', code: '1.6', title: 'Instructions', path: '/instructions' },
]

const MOCK_DATA = {
  students: [
    { id: 1, name: 'Juan Dela Cruz', meta: 'BSCS • 3rd Year • Active' },
    { id: 2, name: 'Maria Santos', meta: 'BSCS • 2nd Year • Active' },
  ],
  faculty: [
    { id: 1, name: 'Prof. Maria Santos', meta: 'Full-time • CS Dept.' },
  ],
  events: [
    { id: 1, name: 'CCS Research Colloquium', meta: 'Apr 15, 2026 • Auditorium' },
  ],
  schedules: [
    { id: 1, name: 'CS101 – Intro to Programming', meta: 'MWF 9:00–10:30 • Lab 2' },
  ],
  research: [
    { id: 1, name: 'AI for Campus Analytics', meta: 'Ongoing • College Research' },
  ],
  instructions: [
    { id: 1, name: 'BSCS Curriculum 2026', meta: 'Updated • Effective AY 26–27' },
  ],
}

const moduleCounts = {
  'student-profile': MOCK_DATA.students.length,
  'faculty-profile': MOCK_DATA.faculty.length,
  events: MOCK_DATA.events.length,
  scheduling: MOCK_DATA.schedules.length,
  'college-research': MOCK_DATA.research.length,
  instructions: MOCK_DATA.instructions.length,
}

const totalRecords = Object.values(moduleCounts).reduce((a, b) => a + b, 0)

function SummaryCard({ label, value, hint, link }) {
  return (
    <Link to={link} className="summary-card summary-card-link">
      <div className="summary-label">{label}</div>
      <div className="summary-value">{value}</div>
      <div className="summary-hint">{hint}</div>
    </Link>
  )
}

export default function Dashboard() {
  const [search, setSearch] = useState('')
  const query = search.toLowerCase()
  const [modules, setModules] = useState(MODULES)

  // --- Weather State ---
  const [weather, setWeather] = useState(null)
  const [weatherLoading, setWeatherLoading] = useState(true)

  useEffect(() => {
    try {
      const raw = localStorage.getItem('authUser')
      const user = raw ? JSON.parse(raw) : null
      const role = user?.role || null
      setModules(
        MODULES.map((m) =>
          m.id === 'student-profile'
            ? { ...m, title: role === 'admin' ? 'Student List' : 'Student Profile' }
            : m
        )
      )
    } catch {
      setModules(MODULES)
    }
  }, [])

  useEffect(() => {
    async function fetchWeather() {
      try {
        // Cabuyao, Philippines Coordinates: Lat 14.2766, Lon 121.1215
        const res = await fetch('https://api.open-meteo.com/v1/forecast?latitude=14.2766&longitude=121.1215&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,surface_pressure,wind_speed_10m,wind_direction_10m&daily=sunrise,sunset&timezone=Asia%2FSingapore')
        const data = await res.json()
        
        // Parse WMO code
        const code = data.current.weather_code
        let icon = '☁️'
        let desc = 'Cloudy'

        if (code === 0) { icon = '☀️'; desc = 'Clear sky' }
        else if (code === 1 || code === 2 || code === 3) { icon = '🌤️'; desc = 'Partly cloudy' }
        else if (code >= 45 && code <= 48) { icon = '🌫️'; desc = 'Fog' }
        else if (code >= 51 && code <= 67) { icon = '🌧️'; desc = 'Rain' }
        else if (code >= 71 && code <= 77) { icon = '❄️'; desc = 'Snow' }
        else if (code >= 80 && code <= 82) { icon = '🌦️'; desc = 'Rain showers' }
        else if (code >= 95) { icon = '⛈️'; desc = 'Thunderstorm' }

        // Format time
        const formatTime = (timeStr) => {
          const d = new Date(timeStr)
          return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
        }

        // Wind Direction
        const deg = data.current.wind_direction_10m
        const dirs = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW']
        const windDir = dirs[Math.round(deg / 22.5) % 16]

        setWeather({
          temp: Math.round(data.current.temperature_2m),
          feelsLike: Math.round(data.current.apparent_temperature),
          humidity: data.current.relative_humidity_2m,
          wind: `${data.current.wind_speed_10m} km/h ${windDir}`,
          pressure: Math.round(data.current.surface_pressure),
          desc,
          icon,
          sunrise: formatTime(data.daily.sunrise[0]),
          sunset: formatTime(data.daily.sunset[0]),
          time: formatTime(data.current.time)
        })
      } catch (err) {
        console.error("Failed to fetch weather:", err)
      } finally {
        setWeatherLoading(false)
      }
    }
    fetchWeather()
  }, [])

  const filteredItems = useMemo(() => {
    const all = [
      ...MOCK_DATA.students.map((i) => ({ ...i, type: 'student', module: 'student-profile' })),
      ...MOCK_DATA.faculty.map((i) => ({ ...i, type: 'faculty', module: 'faculty-profile' })),
      ...MOCK_DATA.events.map((i) => ({ ...i, type: 'event', module: 'events' })),
      ...MOCK_DATA.schedules.map((i) => ({ ...i, type: 'schedule', module: 'scheduling' })),
      ...MOCK_DATA.research.map((i) => ({ ...i, type: 'research', module: 'college-research' })),
      ...MOCK_DATA.instructions.map((i) => ({ ...i, type: 'instruction', module: 'instructions' })),
    ]
    if (!query) return all
    return all.filter(
      (i) =>
        i.name.toLowerCase().includes(query) || i.meta.toLowerCase().includes(query)
    )
  }, [query])

  return (
    <div className="dashboard-page">
      <div className="dashboard-grid">
        <div className="dashboard-main-col">
          <div className="welcome-banner">
            <div className="welcome-banner-inner">
              <div className="welcome-logo-container">
                <img src="/ccs_logo.png" alt="Dashboard Logo" className="welcome-logo" />
              </div>
              <div className="welcome-text-container">
                <div className="welcome-uni-header">College of Computing Studies</div>
              </div>
            </div>
            <div className="welcome-banner-bottom">
              <div>Welcome to <span className="pinnacle-logo-text-banner">CCS Dashboard</span></div>
              <div className="welcome-banner-subtitle">Comprehensive Profiling System</div>
            </div>
          </div>

          <div className="announcements-section">
            <div className="section-header">
              <div className="section-icon-box bg-blue">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
              </div>
              <h3>Announcements</h3>
            </div>
            
            <div className="announcement-card bg-green-light">
              <h4 className="announcement-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                Welcome to the CCS Profiling System 
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"></path><path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"></path><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"></path><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"></path></svg>
              </h4>
              <p className="announcement-text">
                Manage your profile, view submitted requirements, and keep your records up to date.
              </p>
              <p className="announcement-text">
                If you encounter any issues, please check with the administrative staff or submit a feedback form.
              </p>
            </div>
          </div>

          <section className="summary-row" style={{ marginTop: '24px' }}>
            {modules.map((m) => (
              <SummaryCard
                key={m.id}
                label={m.title}
                value={moduleCounts[m.id] ?? 0}
                hint={`View ${m.title}`}
                link={m.path}
              />
            ))}
          </section>

          <section className="content-panel" style={{ marginTop: '24px' }}>
            <div className="content-header">
              <div>
                <h2 className="content-title">Quick View</h2>
                <p className="content-subtitle">
                  Recent records from all modules. Click a module to see full details.
                </p>
              </div>
              <div className="search-section" style={{ minWidth: "200px" }}>
                <input
                  className="search-input"
                  type="text"
                  placeholder="Search modules…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>
            <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Name / Title</th>
                    <th>Details</th>
                    <th>Module</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredItems.length === 0 && (
                    <tr>
                      <td colSpan="4" className="empty-state">
                        No records match your search.
                      </td>
                    </tr>
                  )}
                  {filteredItems.map((item, index) => (
                    <tr key={`${item.type}-${item.id}`}>
                      <td>{index + 1}</td>
                      <td>{item.name}</td>
                      <td>{item.meta}</td>
                      <td className="tag">
                        <Link to={`/${item.module}`}>
                          {modules.find((m) => m.id === item.module)?.title ?? item.module}
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        <div className="dashboard-widgets-col">
          <div className="widget-card date-widget">
            <div className="date-widget-top">
              <span className="date-day-large">11</span>
              <div className="date-month-year">
                <span className="date-weekday">WED</span>
                <span className="date-month">MAR 2026</span>
              </div>
            </div>
            <div className="date-widget-list">
              {/* Future implementation: map through dynamic events */}
              <div className="date-widget-item">No upcoming events today.</div>
            </div>
          </div>

          <div className="widget-card weather-widget">
            <div className="widget-header-title">Weather Forecast</div>
            <div className="widget-header-sub">
              as of {weatherLoading ? '...' : (weather?.time || 'N/A')}
            </div>
            
            {weatherLoading ? (
              <div style={{ padding: '40px 0', textAlign: 'center', opacity: 0.5 }}>Loading weather...</div>
            ) : weather ? (
              <>
                <div className="weather-main">
                  <div className="weather-icon">{weather.icon}</div>
                  <div className="weather-temp">{weather.temp}°C</div>
                </div>
                <div className="weather-desc">{weather.desc}</div>
                <div className="weather-loc">City of Cabuyao, PH</div>

                <div className="weather-details">
                  <div className="weather-detail-row">
                    <span className="weather-detail-label">Feels like</span>
                    <span className="weather-detail-val">{weather.feelsLike}°C</span>
                  </div>
                  <div className="weather-detail-row">
                    <span className="weather-detail-label">Wind</span>
                    <span className="weather-detail-val">{weather.wind}</span>
                  </div>
                  <div className="weather-detail-row">
                    <span className="weather-detail-label">Humidity</span>
                    <span className="weather-detail-val">{weather.humidity}%</span>
                  </div>
                  <div className="weather-detail-row">
                    <span className="weather-detail-label">Pressure</span>
                    <span className="weather-detail-val">{weather.pressure} hPa</span>
                  </div>
                </div>

                <div className="weather-sun-times">
                  <div className="sun-time">
                    <span className="sun-icon" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v8"/><path d="m4.93 10.93 1.41 1.41"/><path d="M2 18h2"/><path d="M20 18h2"/><path d="m19.07 10.93-1.41 1.41"/><path d="M22 22H2"/><path d="m8 6 4-4 4 4"/><path d="M16 18a4 4 0 0 0-8 0"/></svg> 
                      Sunrise
                    </span>
                    <span className="sun-val">{weather.sunrise}</span>
                  </div>
                  <div className="sun-time">
                    <span className="sun-icon" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 10V2"/><path d="m4.93 10.93 1.41 1.41"/><path d="M2 18h2"/><path d="M20 18h2"/><path d="m19.07 10.93-1.41 1.41"/><path d="M22 22H2"/><path d="m16 5-4 4-4-4"/><path d="M16 18a4 4 0 0 0-8 0"/></svg>
                      Sunset
                    </span>
                    <span className="sun-val">{weather.sunset}</span>
                  </div>
                </div>
              </>
            ) : (
              <div style={{ padding: '20px 0', color: '#ef4444' }}>Unable to load weather.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
