import { useCallback, useEffect, useMemo, useState } from 'react'
import { CountrySearch } from './components/CountrySearch'
import { MetricsPanel } from './components/MetricsPanel'
import { WorldMap } from './components/WorldMap'
import { loadConflicts } from './services/conflictService'
import { getCountryName, loadWorldGeoData } from './services/geoService'
import type { Conflict, CountryFeatureCollection, Metrics } from './types'

const START_YEAR = 1900

type ConflictWithEnd = Conflict & { end?: string }

type AIStatus = {
  available: boolean
  lastRefresh: string
  suggestedCount: number
  mode: 'preview' | 'applied'
}

function daysSince(dateText: string): number {
  const ms = Date.now() - new Date(dateText).getTime()
  return Math.max(0, Math.floor(ms / (1000 * 60 * 60 * 24)))
}

function yearFromDate(dateText?: string): number | null {
  if (!dateText) return null
  const year = Number(dateText.slice(0, 4))
  return Number.isFinite(year) ? year : null
}

/**
 * Timeline-aware active-state logic used by metrics.
 * Active means started on/before selected year and has no end or ends after selected year.
 */
function isActiveInYear(conflict: ConflictWithEnd, selectedYear: number): boolean {
  const startYear = yearFromDate(conflict.start)
  if (startYear !== null && startYear > selectedYear) return false

  const endYear = yearFromDate(conflict.end)
  if (endYear !== null && endYear < selectedYear) return false

  if (conflict.active === true) return true

  return endYear === null
}

/**
 * Days without active war in a scope:
 * - 0 when at least one active conflict exists in selected year
 * - otherwise since most recently ended conflict
 */
function daysWithoutActiveWar(conflicts: ConflictWithEnd[], selectedYear: number): number {
  if (!conflicts.length) return 0

  const hasActive = conflicts.some((conflict) => isActiveInYear(conflict, selectedYear))
  if (hasActive) return 0

  const lastEnded = conflicts
    .map((conflict) => conflict.end)
    .filter((value): value is string => Boolean(value))
    .sort((a, b) => b.localeCompare(a))[0]

  return lastEnded ? daysSince(lastEnded) : 0
}

/** Build timeline-aware tactical metrics for world + selected country scope. */
function buildMetrics(allConflicts: ConflictWithEnd[], selectedCountry: string, selectedYear: number): Metrics {
  const inTimeline = allConflicts.filter((conflict) => {
    const startYear = yearFromDate(conflict.start)
    return startYear === null || startYear <= selectedYear
  })

  const activeConflictsList = inTimeline.filter((conflict) => isActiveInYear(conflict, selectedYear))

  const countriesAtWar = new Set(activeConflictsList.flatMap((conflict) => [conflict.country, conflict.opponent])).size

  const selectedScope = selectedCountry
    ? inTimeline.filter((conflict) => conflict.country === selectedCountry || conflict.opponent === selectedCountry)
    : inTimeline

  return {
    totalConflicts: inTimeline.length,
    activeConflicts: activeConflictsList.length,
    countriesAtWar,
    globalDaysWithoutWar: daysWithoutActiveWar(inTimeline, selectedYear),
    selectedCountryConflicts: selectedScope.length,
    selectedCountryDaysWithoutWar: daysWithoutActiveWar(selectedScope, selectedYear)
  }
}

export default function App() {
  const [geoData, setGeoData] = useState<CountryFeatureCollection | null>(null)
  const [conflicts, setConflicts] = useState<ConflictWithEnd[]>([])
  const [selectedCountry, setSelectedCountry] = useState('')
  const [hoverText, setHoverText] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [timelineYear, setTimelineYear] = useState(new Date().getFullYear())
  const [resetMapSignal, setResetMapSignal] = useState(0)
  const [lastUpdated, setLastUpdated] = useState('')

  const [isAdmin, setIsAdmin] = useState(false)
  const [showAdminPanel, setShowAdminPanel] = useState(false)
  const [adminEmail, setAdminEmail] = useState('')
  const [adminCode, setAdminCode] = useState('')
  const [adminMessage, setAdminMessage] = useState('')
  const [adminBusy, setAdminBusy] = useState(false)
  const [aiActionBusy, setAiActionBusy] = useState(false)

  const [aiStatus, setAiStatus] = useState<AIStatus>({
    available: true,
    lastRefresh: '—',
    suggestedCount: 0,
    mode: 'preview'
  })

  const refreshAdminStatus = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/status', { credentials: 'include' })
      if (!response.ok) return
      const data = (await response.json()) as { isAdmin?: boolean }
      setIsAdmin(Boolean(data.isAdmin))
    } catch {
      // Keep UI passive when server auth status is unavailable.
    }
  }, [])

  const loadDashboardData = useCallback(async () => {
    try {
      setLoading(true)
      setError('')

      const [world, loadedConflicts] = await Promise.all([loadWorldGeoData(), loadConflicts()])
      setGeoData(world)
      setConflicts(loadedConflicts as ConflictWithEnd[])
      setLastUpdated(new Date().toLocaleTimeString())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadDashboardData()
    refreshAdminStatus()
  }, [loadDashboardData, refreshAdminStatus])

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key.toLowerCase() === 'f') {
        const input = document.getElementById('country-search') as HTMLInputElement | null
        input?.focus()
      }

      if (event.key === 'Escape') {
        if (showAdminPanel) {
          setShowAdminPanel(false)
          setAdminMessage('')
          return
        }
        setSelectedCountry('')
      }

      if (event.key.toLowerCase() === 'r') {
        setResetMapSignal((value) => value + 1)
      }

      if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === 'a') {
        event.preventDefault()
        setShowAdminPanel((prev) => !prev)
        setAdminMessage('')
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [showAdminPanel])

  const countries = useMemo(() => {
    if (!geoData) return []

    return geoData.features
      .map((feature) => getCountryName(feature))
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b))
  }, [geoData])

  const timelineFilteredConflicts = useMemo(() => {
    return conflicts.filter((conflict) => {
      const year = yearFromDate(conflict.start)
      return year === null || year <= timelineYear
    })
  }, [conflicts, timelineYear])

  const visibleConflicts = useMemo(() => {
    if (!selectedCountry) return timelineFilteredConflicts

    return timelineFilteredConflicts.filter(
      (conflict) => conflict.country === selectedCountry || conflict.opponent === selectedCountry
    )
  }, [timelineFilteredConflicts, selectedCountry])

  const metrics = useMemo(() => buildMetrics(conflicts, selectedCountry, timelineYear), [conflicts, selectedCountry, timelineYear])

  const selectedCountryConflicts = useMemo(() => {
    if (!selectedCountry) return []
    return visibleConflicts.filter((conflict) => conflict.country === selectedCountry || conflict.opponent === selectedCountry)
  }, [selectedCountry, visibleConflicts])

  const recentConflicts = useMemo(() => {
    return [...visibleConflicts]
      .filter((conflict) => Boolean(conflict.start))
      .sort((a, b) => String(b.start).localeCompare(String(a.start)))
      .slice(0, 3)
  }, [visibleConflicts])

  async function sendAdminCode() {
    try {
      setAdminBusy(true)
      setAdminMessage('Sending code…')

      const response = await fetch('/api/admin/request-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email: adminEmail.trim() })
      })

      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as { message?: string }
        setAdminMessage(data.message || 'Unable to send code.')
        return
      }

      setAdminMessage('Code sent. Check admin email.')
    } catch {
      setAdminMessage('Failed to send code.')
    } finally {
      setAdminBusy(false)
    }
  }

  async function verifyAdminCode() {
    try {
      setAdminBusy(true)
      setAdminMessage('Verifying…')

      const response = await fetch('/api/admin/verify-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email: adminEmail.trim(), code: adminCode.trim() })
      })

      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as { message?: string }
        setAdminMessage(data.message || 'Verification failed.')
        return
      }

      await refreshAdminStatus()
      setShowAdminPanel(false)
      setAdminCode('')
      setAdminMessage('Admin verified.')
    } catch {
      setAdminMessage('Verification failed.')
    } finally {
      setAdminBusy(false)
    }
  }

  async function runAiAction(path: '/api/update-conflicts' | '/api/apply-conflicts') {
    try {
      setAiActionBusy(true)
      const response = await fetch(path, {
        method: path === '/api/apply-conflicts' ? 'POST' : 'GET',
        credentials: 'include'
      })

      if (response.status === 401 || response.status === 403) {
        setIsAdmin(false)
        setAdminMessage('Admin session expired. Re-authenticate.')
        return
      }

      const now = new Date().toLocaleTimeString()
      const nextMode = path === '/api/apply-conflicts' ? 'applied' : 'preview'
      setAiStatus((prev) => ({ ...prev, lastRefresh: now, mode: nextMode }))
      setAdminMessage(path === '/api/apply-conflicts' ? 'Apply request sent.' : 'Refresh request sent.')
    } catch {
      setAdminMessage('AI action failed.')
    } finally {
      setAiActionBusy(false)
    }
  }

  return (
    <main className="app-shell tactical-shell">
      <header className="panel header-row tactical-header">
        <div>
          <h1 onDoubleClick={() => setShowAdminPanel((prev) => !prev)}>Global War Tracker</h1>
          <span className="header-tag">Tactical Command Console</span>
          <p>{loading ? 'Tactical feed sync in progress…' : `Command feed online • ${lastUpdated || '—'}`}</p>
        </div>
        <button type="button" className="btn-mini" onClick={loadDashboardData} disabled={loading}>
          {loading ? 'Sync…' : 'Refresh'}
        </button>
      </header>

      <section className="panel status-row tactical-status">
        <span>{selectedCountry ? `Target: ${selectedCountry}` : 'Target: Global overview'}</span>
        <small>R to reset map view</small>
      </section>

      <section className="control-row">
        <CountrySearch countries={countries} selectedCountry={selectedCountry} onSelectCountry={setSelectedCountry} />
        <section className="panel timeline-panel">
          <label htmlFor="timeline-year">Year {timelineYear}</label>
          <input
            id="timeline-year"
            type="range"
            min={START_YEAR}
            max={new Date().getFullYear()}
            value={timelineYear}
            onChange={(event) => setTimelineYear(Number(event.target.value))}
          />
        </section>
      </section>

      <MetricsPanel metrics={metrics} />

      <section className="main-grid">
        <section className="map-stack">
          {error && <section className="panel error">{error}</section>}

          {geoData && !error && (
            <WorldMap
              geoData={geoData}
              conflicts={visibleConflicts}
              selectedCountry={selectedCountry}
              onSelectCountry={setSelectedCountry}
              onHoverText={setHoverText}
              resetSignal={resetMapSignal}
            />
          )}

          <footer className="panel footer-panel">{hoverText || 'F: focus search • ESC: clear country • R: reset map'}</footer>
        </section>

        <aside className="side-column">
          <section className="panel side-panel intel-card">
            <h3>Legend</h3>
            <ul className="compact-list">
              <li>Land brightness = conflict intensity</li>
              <li>Red routes = conflict flows</li>
              <li>Hover = target tooltip</li>
            </ul>
          </section>

          <section className="panel side-panel intel-card ai-status-card">
            <h3>AI conflict feed</h3>
            <small className="intel-subtitle">Staged refresh channel</small>
            <ul className="compact-list ai-status-list">
              <li>AI update available: {aiStatus.available ? 'Yes' : 'No'}</li>
              <li>Last AI refresh: {aiStatus.lastRefresh}</li>
              <li>Suggested conflicts: {aiStatus.suggestedCount}</li>
              <li>AI mode: {aiStatus.mode}</li>
              <li>Admin session: {isAdmin ? 'Active' : 'Locked'}</li>
            </ul>
            {isAdmin ? (
              <div className="ai-admin-controls">
                <button type="button" className="btn-mini" onClick={() => runAiAction('/api/update-conflicts')} disabled={aiActionBusy}>
                  AI Refresh
                </button>
                <button
                  type="button"
                  className="btn-mini btn-secondary"
                  onClick={() => runAiAction('/api/apply-conflicts')}
                  disabled={aiActionBusy}
                >
                  Apply AI
                </button>
              </div>
            ) : (
              <small className="ai-admin-note">Admin controls hidden (double-click title or Ctrl+Shift+A)</small>
            )}
          </section>

          <section className="panel side-panel intel-card">
            <h3>Operations log</h3>
            <small className="intel-subtitle">Latest confirmed signals</small>
            <ul className="compact-list">
              {recentConflicts.map((conflict, index) => (
                <li key={`${conflict.country}-${conflict.opponent}-${index}`}>
                  <strong>{conflict.country}</strong> vs {conflict.opponent}
                  <small>{conflict.start || 'Unknown'}</small>
                </li>
              ))}
            </ul>
          </section>

          <section className="panel side-panel intel-card">
            <h3>{selectedCountry || 'No target selected'}</h3>
            <small className="intel-subtitle">Target intelligence</small>
            <p>
              {selectedCountry
                ? `${selectedCountryConflicts.length} linked conflict${selectedCountryConflicts.length === 1 ? '' : 's'}`
                : 'Select a country from map or search'}
            </p>
            {selectedCountry && (
              <ul className="compact-list">
                {selectedCountryConflicts.slice(0, 3).map((conflict, index) => {
                  const opponent = conflict.country === selectedCountry ? conflict.opponent : conflict.country
                  return <li key={`${opponent}-${index}`}>{opponent}</li>
                })}
              </ul>
            )}
          </section>
        </aside>
      </section>

      {showAdminPanel && (
        <section className="admin-auth-backdrop" onClick={() => setShowAdminPanel(false)}>
          <div className="panel admin-auth-panel" onClick={(event) => event.stopPropagation()}>
            <h3>Admin verification</h3>
            <label htmlFor="admin-email">Admin email</label>
            <input
              id="admin-email"
              type="email"
              value={adminEmail}
              onChange={(event) => setAdminEmail(event.target.value)}
              placeholder="admin@example.com"
            />

            <div className="admin-auth-actions">
              <button type="button" className="btn-mini" onClick={sendAdminCode} disabled={adminBusy || !adminEmail.trim()}>
                Send code
              </button>
            </div>

            <label htmlFor="admin-code">One-time code</label>
            <input
              id="admin-code"
              type="text"
              value={adminCode}
              onChange={(event) => setAdminCode(event.target.value)}
              placeholder="123456"
            />

            <div className="admin-auth-actions">
              <button type="button" className="btn-mini" onClick={verifyAdminCode} disabled={adminBusy || !adminCode.trim()}>
                Verify
              </button>
              <button type="button" className="btn-mini btn-secondary" onClick={() => setShowAdminPanel(false)}>
                Close
              </button>
            </div>

            {adminMessage && <small className="admin-auth-message">{adminMessage}</small>}
          </div>
        </section>
      )}
    </main>
  )
}
