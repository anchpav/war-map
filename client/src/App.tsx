import { useCallback, useEffect, useMemo, useState } from 'react'
import { CountrySearch } from './components/CountrySearch'
import { MetricsPanel } from './components/MetricsPanel'
import { WorldMap } from './components/WorldMap'
import { loadConflicts } from './services/conflictService'
import { getCountryName, loadWorldGeoData } from './services/geoService'
import type { Conflict, CountryFeatureCollection, Metrics } from './types'

const START_YEAR = 1900

function daysSince(dateText: string): number {
  const ms = Date.now() - new Date(dateText).getTime()
  return Math.max(0, Math.floor(ms / (1000 * 60 * 60 * 24)))
}

/** Return days since last conflict start date in the provided scope. */
function daysWithoutWar(conflicts: Conflict[]): number {
  if (!conflicts.length) return 0

  const latest = conflicts
    .map((conflict) => conflict.start)
    .filter((value): value is string => Boolean(value))
    .sort((a, b) => b.localeCompare(a))[0]

  return latest ? daysSince(latest) : 0
}

/** Build compact tactical metrics from current map scope. */
function buildMetrics(allConflicts: Conflict[], visibleConflicts: Conflict[], selectedCountry: string): Metrics {
  const activeConflicts = visibleConflicts.filter((conflict) => conflict.active).length

  const countriesAtWar = new Set(
    visibleConflicts.filter((conflict) => conflict.active).flatMap((conflict) => [conflict.country, conflict.opponent])
  ).size

  const selectedScope = selectedCountry
    ? visibleConflicts.filter((conflict) => conflict.country === selectedCountry || conflict.opponent === selectedCountry)
    : visibleConflicts

  return {
    totalConflicts: visibleConflicts.length,
    activeConflicts,
    countriesAtWar,
    globalDaysWithoutWar: daysWithoutWar(allConflicts),
    selectedCountryConflicts: selectedScope.length,
    selectedCountryDaysWithoutWar: daysWithoutWar(selectedScope)
  }
}

export default function App() {
  const [geoData, setGeoData] = useState<CountryFeatureCollection | null>(null)
  const [conflicts, setConflicts] = useState<Conflict[]>([])
  const [selectedCountry, setSelectedCountry] = useState('')
  const [hoverText, setHoverText] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [timelineYear, setTimelineYear] = useState(new Date().getFullYear())
  const [resetMapSignal, setResetMapSignal] = useState(0)
  const [lastUpdated, setLastUpdated] = useState('')

  const loadDashboardData = useCallback(async () => {
    try {
      setLoading(true)
      setError('')

      const [world, loadedConflicts] = await Promise.all([loadWorldGeoData(), loadConflicts()])
      setGeoData(world)
      setConflicts(loadedConflicts)
      setLastUpdated(new Date().toLocaleTimeString())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadDashboardData()
  }, [loadDashboardData])

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key.toLowerCase() === 'f') {
        const input = document.getElementById('country-search') as HTMLInputElement | null
        input?.focus()
      }

      if (event.key === 'Escape') {
        setSelectedCountry('')
      }

      if (event.key.toLowerCase() === 'r') {
        setResetMapSignal((value) => value + 1)
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  const countries = useMemo(() => {
    if (!geoData) return []

    return geoData.features
      .map((feature) => getCountryName(feature))
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b))
  }, [geoData])

  const timelineFilteredConflicts = useMemo(() => {
    return conflicts.filter((conflict) => {
      if (!conflict.start) return true
      const year = Number(conflict.start.slice(0, 4))
      return year <= timelineYear
    })
  }, [conflicts, timelineYear])

  const visibleConflicts = useMemo(() => {
    if (!selectedCountry) return timelineFilteredConflicts

    return timelineFilteredConflicts.filter(
      (conflict) => conflict.country === selectedCountry || conflict.opponent === selectedCountry
    )
  }, [timelineFilteredConflicts, selectedCountry])

  const metrics = useMemo(
    () => buildMetrics(conflicts, visibleConflicts, selectedCountry),
    [conflicts, visibleConflicts, selectedCountry]
  )

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

  return (
    <main className="app-shell tactical-shell">
      <header className="panel header-row tactical-header">
        <div>
          <h1>Global War Tracker</h1>
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

          <section className="panel side-panel intel-card">
            <h3>Operations log</h3>
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
    </main>
  )
}
