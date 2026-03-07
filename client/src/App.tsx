import { useEffect, useMemo, useState } from 'react'
import { CountrySearch } from './components/CountrySearch'
import { MetricsPanel } from './components/MetricsPanel'
import { WorldMap } from './components/WorldMap'
import { getConflicts, getWorldGeoJSON } from './api/api'
import type { Conflict, Metrics } from './types'

function daysSince(dateText: string): number {
  const ms = Date.now() - new Date(dateText).getTime()
  return Math.max(0, Math.floor(ms / (1000 * 60 * 60 * 24)))
}

/**
 * Days without war = days since latest conflict start date.
 * If there is a conflict starting today then this becomes 0.
 */
function globalDaysWithoutWar(conflicts: Conflict[]): number {
  if (!conflicts.length) return 0
  const latest = conflicts
    .map((c) => c.start)
    .filter((s): s is string => Boolean(s))
    .sort((a, b) => b.localeCompare(a))[0]
  return latest ? daysSince(latest) : 0
}

function buildMetrics(conflicts: Conflict[], selectedCountry: string): Metrics {
  const activeConflicts = conflicts.filter((c) => c.active).length
  const countriesAtWar = new Set(conflicts.filter((c) => c.active).flatMap((c) => [c.country, c.opponent])).size
  const selectedCountryConflicts = selectedCountry
    ? conflicts.filter((c) => c.country === selectedCountry || c.opponent === selectedCountry).length
    : conflicts.length

  return {
    activeConflicts,
    countriesAtWar,
    globalDaysWithoutWar: globalDaysWithoutWar(conflicts),
    selectedCountryConflicts,
    totalConflicts: conflicts.length
  }
}

export default function App() {
  const [geoData, setGeoData] = useState<any | null>(null)
  const [conflicts, setConflicts] = useState<Conflict[]>([])
  const [selectedCountry, setSelectedCountry] = useState('')
  const [hoverText, setHoverText] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    async function load() {
      try {
        const [world, loadedConflicts] = await Promise.all([getWorldGeoJSON(), getConflicts()])
        setGeoData(world)
        setConflicts(loadedConflicts)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load data.')
      }
    }

    load()
  }, [])

  const countries = useMemo(() => {
    if (!geoData) return []
    return geoData.features
      .map((feature: any) => String(feature.properties?.ADMIN ?? feature.properties?.name ?? ''))
      .filter(Boolean)
      .sort((a: string, b: string) => a.localeCompare(b))
  }, [geoData])

  const visibleConflicts = useMemo(() => {
    if (!selectedCountry) return conflicts
    return conflicts.filter((c) => c.country === selectedCountry || c.opponent === selectedCountry)
  }, [conflicts, selectedCountry])

  const metrics = useMemo(() => buildMetrics(visibleConflicts, selectedCountry), [visibleConflicts, selectedCountry])

  return (
    <main className="app-shell">
      <header className="header panel">
        <h1>Global War Tracker</h1>
      </header>

      <CountrySearch countries={countries} selectedCountry={selectedCountry} onSelectCountry={setSelectedCountry} />
      <MetricsPanel metrics={metrics} />

      {error && <section className="panel error">{error}</section>}

      {geoData && !error && (
        <WorldMap
          geoData={geoData}
          conflicts={visibleConflicts}
          selectedCountry={selectedCountry}
          onSelectCountry={setSelectedCountry}
          onHoverText={setHoverText}
        />
      )}

      <footer className="panel footer-panel">{hoverText || 'Hover map countries or conflict lines.'}</footer>
    </main>
  )
}
