import type { Metrics } from '../types'

type MetricsPanelProps = {
  metrics: Metrics
}

/** Compact KPI strip for a single-screen tactical dashboard. */
export function MetricsPanel({ metrics }: MetricsPanelProps) {
  return (
    <section className="metrics-grid">
      <article className="panel metric-card">
        <span>Active</span>
        <strong>{metrics.activeConflicts}</strong>
      </article>
      <article className="panel metric-card">
        <span>Total</span>
        <strong>{metrics.totalConflicts}</strong>
      </article>
      <article className="panel metric-card">
        <span>Countries At War</span>
        <strong>{metrics.countriesAtWar}</strong>
      </article>
      <article className="panel metric-card">
        <span>World Peace Days</span>
        <strong>{metrics.globalDaysWithoutWar}</strong>
      </article>
      <article className="panel metric-card">
        <span>Selected Peace Days</span>
        <strong>{metrics.selectedCountryDaysWithoutWar}</strong>
      </article>
      <article className="panel metric-card">
        <span>Selected Conflicts</span>
        <strong>{metrics.selectedCountryConflicts}</strong>
      </article>
    </section>
  )
}
