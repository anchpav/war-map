import { useEffect, useMemo, useState } from 'react'
import { CountrySearch } from './components/CountrySearch'
import { MetricsPanel } from './components/MetricsPanel'
import { WorldMap } from './components/WorldMap'
import { fetchConflicts } from './services/conflictService'
import { fetchWorldGeoJSON } from './services/geoService'
import type { Conflict, Metrics } from './types'

function daysSince(dateText: string): number {
  const ms = Date.now() - new Date(dateText).getTime()
  return Math.max(0, Math.floor(ms / (1000 * 60 * 60 * 24)))
}

/**
 * Return 0 when there is an active conflict in scope.
 * Otherwise return days since the most recent ended conflict.
 */
function daysWithoutWar(conflicts: Conflict[], selectedCountry?: string): number {
  const scoped = selectedCountry
    ? conflicts.filter(
        (item) =>
          item.country.toLowerCase() === selectedCountry.toLowerCase() ||
          item.opponent.toLowerCase() === selectedCountry.toLowerCase()
      )
    : conflicts

  if (scoped.length === 0) return 0
  if (scoped.some((item) => item.end === null)) return 0

  const ended = scoped.map((item) => item.end).filter((value): value is string => Boolean(value))
  if (ended.length === 0) return 0

  const mostRecent = ended.sort((a, b) => b.localeCompare(a))[0]
  return daysSince(mostRecent)
}

function calculateMetrics(conflicts: Conflict[], selectedCountry: string): Metrics {
  const scoped = selectedCountry
    ? conflicts.filter(
        (item) =>
          item.country.toLowerCase() === selectedCountry.toLowerCase() ||
          item.opponent.toLowerCase() === selectedCountry.toLowerCase()
      )
    : conflicts

  return {
    totalConflicts: scoped.length,
    activeConflicts: scoped.filter((item) => item.end === null).length,
    daysWithoutWarWorld: daysWithoutWar(conflicts),
    daysWithoutWarSelected: daysWithoutWar(conflicts, selectedCountry)
  }
}

export default function App() {
  const [geoData, setGeoData] = useState<any | null>(null)
  const [conflicts, setConflicts] = useState<Conflict[]>([])
  const [selectedCountry, setSelectedCountry] = useState('')
  const [hoverText, setHoverText] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadData() {
      setLoading(true)
      setErrorMessage('')

      try {
        const [world, loadedConflicts] = await Promise.all([fetchWorldGeoJSON(), fetchConflicts()])
        setGeoData(world)
        setConflicts(loadedConflicts)
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unexpected loading error.'
        setErrorMessage(message)
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [])

  const countries = useMemo(() => {
    if (!geoData) return []

    return geoData.features
      .map((feature: any) => String(feature.properties?.name ?? ''))
      .filter(Boolean)
      .sort((a: string, b: string) => a.localeCompare(b))
  }, [geoData])

  const filteredConflicts = useMemo(() => {
    if (!selectedCountry) return conflicts

    return conflicts.filter(
      (item) =>
        item.country.toLowerCase() === selectedCountry.toLowerCase() ||
        item.opponent.toLowerCase() === selectedCountry.toLowerCase()
    )
  }, [conflicts, selectedCountry])

  const metrics = useMemo(() => calculateMetrics(conflicts, selectedCountry), [conflicts, selectedCountry])

  return (
    <main className="app-shell">
      <header className="header">
        <h1>Global War Tracker</h1>
      </header>

      <CountrySearch countries={countries} selectedCountry={selectedCountry} onSelectCountry={setSelectedCountry} />

      <MetricsPanel metrics={metrics} />

      {loading && <section className="panel">Loading map and conflicts...</section>}
      {errorMessage && <section className="panel error">{errorMessage}</section>}

      {!loading && !errorMessage && geoData && (
        <WorldMap
          geoData={geoData}
          conflicts={filteredConflicts}
          selectedCountry={selectedCountry}
          onSelectCountry={setSelectedCountry}
          onHoverText={setHoverText}
        />
      )}

      <footer className="panel footer-panel">
        {hoverText || 'Hover a country or conflict line to see details.'}
      </footer>
    </main>
  )
}
