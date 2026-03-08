import { useEffect, useMemo, useState } from 'react'
import { CountrySearch } from './components/CountrySearch'
import { MetricsPanel } from './components/MetricsPanel'
import { WorldMap } from './components/WorldMap'
import { loadConflicts } from './services/conflictService'
import { loadWorldGeoData, getCountryName } from './services/geoService'
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

/** Build small dashboard metrics from current filtered conflicts. */
function buildMetrics(allConflicts: Conflict[], visibleConflicts: Conflict[], selectedCountry: string): Metrics {
  const activeConflicts = visibleConflicts.filter((conflict) => conflict.active !== false).length

  const countriesAtWar = new Set(
    visibleConflicts
      .filter((conflict) => conflict.active !== false)
      .flatMap((conflict) => [conflict.country, conflict.opponent])
  ).size

  const selectedScope = selectedCountry
    ? visibleConflicts.filter(
        (conflict) => conflict.country === selectedCountry || conflict.opponent === selectedCountry
      )
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
  const [timelineYear, setTimelineYear] = useState(new Date().getFullYear())
  const [resetMapSignal, setResetMapSignal] = useState(0)

  useEffect(() => {
    async function load() {
      try {
        const [world, loadedConflicts] = await Promise.all([loadWorldGeoData(), loadConflicts()])
        setGeoData(world)
        setConflicts(loadedConflicts)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load data.')
      }
    }

    load()
  }, [])

  // Keyboard shortcuts
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
      .sort((a: string, b: string) => a.localeCompare(b))
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
    return visibleConflicts.filter(
      (conflict) => conflict.country === selectedCountry || conflict.opponent === selectedCountry
    )
  }, [selectedCountry, visibleConflicts])

  const recentConflicts = useMemo(() => {
    return [...visibleConflicts]
      .filter((conflict) => Boolean(conflict.start))
      .sort((a, b) => String(b.start).localeCompare(String(a.start)))
      .slice(0, 6)
  }, [visibleConflicts])

  return (
    <main className="app-shell">
      <header className="header panel">
        <h1>Global War Tracker</h1>
        <p>Interactive geopolitical conflict dashboard powered by React + D3.</p>
      </header>

      <CountrySearch countries={countries} selectedCountry={selectedCountry} onSelectCountry={setSelectedCountry} />

      <section className="panel timeline-panel">
        <label htmlFor="timeline-year">Timeline year: {timelineYear}</label>
        <input
          id="timeline-year"
          type="range"
          min={START_YEAR}
          max={new Date().getFullYear()}
          value={timelineYear}
          onChange={(event) => setTimelineYear(Number(event.target.value))}
        />
      </section>

      <MetricsPanel metrics={metrics} />

      {error && <section className="panel error">{error}</section>}

      <section className="layout-grid">
        <section>
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
          <footer className="panel footer-panel">
            {hoverText || 'Hover countries and lines for details.'}
          </footer>
        </section>

        <aside className="side-column">
          <section className="panel">
            <h3>Legend</h3>
            <ul>
              <li>Land brightness = conflict heat intensity.</li>
              <li>Red moving curves = conflict flows.</li>
              <li>Hover country = quick tooltip.</li>
            </ul>
          </section>

          <section className="panel">
            <h3>Recent conflicts</h3>
            <ul className="compact-list">
              {recentConflicts.map((conflict, index) => (
                <li key={`${conflict.country}-${conflict.opponent}-${index}`}>
                  <strong>{conflict.country}</strong> vs {conflict.opponent} ({conflict.start || 'Unknown'})
                </li>
              ))}
            </ul>
          </section>

          {selectedCountry && (
            <section className="panel">
              <h3>{selectedCountry}</h3>
              <p>Conflicts involving this country:</p>
              <ul className="compact-list">
                {selectedCountryConflicts.map((conflict, index) => {
                  const opponent = conflict.country === selectedCountry ? conflict.opponent : conflict.country
                  return (
                    <li key={`${opponent}-${index}`}>
                      {selectedCountry} — {opponent}
                    </li>
                  )
                })}
              </ul>
            </section>
          )}
        </aside>
      </section>
    </main>
  )
}
