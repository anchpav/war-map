import type { Metrics } from '../types'

type MetricsPanelProps = {
  metrics: Metrics
}

/** Tactical telemetry row for fast KPI scanning. */
export function MetricsPanel({ metrics }: MetricsPanelProps) {
  return (
    <section className="metrics-grid">
      <article className="panel metric-card alert">
        <span>Active conflicts</span>
        <strong>{metrics.activeConflicts}</strong>
      </article>
      <article className="panel metric-card">
        <span>Total conflicts</span>
        <strong>{metrics.totalConflicts}</strong>
      </article>
      <article className="panel metric-card">
        <span>Countries at war</span>
        <strong>{metrics.countriesAtWar}</strong>
      </article>
      <article className="panel metric-card">
        <span>World peace days</span>
        <strong>{metrics.globalDaysWithoutWar}</strong>
      </article>
      <article className="panel metric-card">
        <span>Selected peace days</span>
        <strong>{metrics.selectedCountryDaysWithoutWar}</strong>
      </article>
      <article className="panel metric-card">
        <span>Selected conflicts</span>
        <strong>{metrics.selectedCountryConflicts}</strong>
      </article>
    </section>
  )
}
