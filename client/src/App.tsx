import { useEffect, useMemo, useState } from 'react'
import { CountrySearch } from './components/CountrySearch'
import { MetricsPanel } from './components/MetricsPanel'
import { WorldMap } from './components/WorldMap'
import { fetchConflicts, updateConflictsFromAI } from './services/conflictService'
import { fetchWorldGeoJSON } from './services/geoService'
import { buildMetrics } from './utils/metrics'
import type { Conflict } from './types'

export default function App() {
  const [geoData, setGeoData] = useState<any | null>(null)
  const [conflicts, setConflicts] = useState<Conflict[]>([])
  const [selectedCountry, setSelectedCountry] = useState('')
  const [tooltip, setTooltip] = useState('')
  const [status, setStatus] = useState('Loading data...')

  useEffect(() => {
    async function load() {
      try {
        const [world, conflictsResponse] = await Promise.all([fetchWorldGeoJSON(), fetchConflicts()])
        setGeoData(world)
        setConflicts(conflictsResponse.conflicts)
        setStatus('Ready')
      } catch (error) {
        setStatus('Failed to load data')
      }
    }

    load()
  }, [])

  const countries = useMemo(() => {
    if (!geoData) return []
    return geoData.features.map((feature: any) => feature.properties?.name).filter(Boolean).sort()
  }, [geoData])

  const visibleConflicts = useMemo(() => {
    if (!selectedCountry) return conflicts
    return conflicts.filter((conflict) =>
      conflict.countries.some((country) => country.toLowerCase() === selectedCountry.toLowerCase())
    )
  }, [conflicts, selectedCountry])

  const metrics = useMemo(() => buildMetrics(conflicts, selectedCountry), [conflicts, selectedCountry])

  async function handleRefresh() {
    const conflictsResponse = await fetchConflicts()
    setConflicts(conflictsResponse.conflicts)
  }

  async function handleUpdateAI() {
    setStatus('Updating from AI placeholder...')
    const result = await updateConflictsFromAI()
    await handleRefresh()
    setStatus(result.message)
  }

  if (!geoData) {
    return <main className="app-shell">{status}</main>
  }

  return (
    <main className="app-shell">
      <header className="header">
        <h1>Global War Tracker</h1>
        <div className="actions">
          <button onClick={handleRefresh}>Refresh Data</button>
          <button onClick={handleUpdateAI}>Update Conflicts (AI)</button>
        </div>
      </header>

      <CountrySearch
        countries={countries}
        selectedCountry={selectedCountry}
        onSelectCountry={setSelectedCountry}
      />

      <MetricsPanel metrics={metrics} />

      <WorldMap
        geoData={geoData}
        conflicts={visibleConflicts}
        selectedCountry={selectedCountry}
        onSelectCountry={setSelectedCountry}
        onTooltipChange={setTooltip}
      />

      <footer className="panel footer-panel">
        <div>{tooltip || 'Hover a country or conflict line to see details.'}</div>
        <div className="status">{status}</div>
      </footer>
    </main>
  )
}
