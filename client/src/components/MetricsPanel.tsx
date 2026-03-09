import type { Metrics } from '../types'

type MetricsPanelProps = {
  metrics: Metrics
}

/** Tactical telemetry strip: dense and quickly scannable. */
export function MetricsPanel({ metrics }: MetricsPanelProps) {
  return (
    <section className="metrics-grid">
      <article className="panel metric-card alert">
        <span>Active conflicts</span>
        <strong>{metrics.activeConflicts}</strong>
      </article>
      <article className="panel metric-card">
        <span>Countries at war</span>
        <strong>{metrics.countriesAtWar}</strong>
      </article>
      <article className="panel metric-card">
        <span>Days without active war</span>
        <strong>{metrics.globalDaysWithoutWar}</strong>
      </article>
      <article className="panel metric-card">
        <span>Selected no-war days</span>
        <strong>{metrics.selectedCountryDaysWithoutWar}</strong>
      </article>
      <article className="panel metric-card">
        <span>Selected conflicts</span>
        <strong>{metrics.selectedCountryConflicts}</strong>
      </article>
      <article className="panel metric-card">
        <span>Timeline conflicts</span>
        <strong>{metrics.totalConflicts}</strong>
      </article>
    </section>
  )
}
