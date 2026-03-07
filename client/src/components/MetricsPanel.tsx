import type { Metrics } from '../types'

type MetricsPanelProps = {
  metrics: Metrics
}

/** Small dashboard cards for key numbers. */
export function MetricsPanel({ metrics }: MetricsPanelProps) {
  return (
    <section className="metrics-grid">
      <article className="panel metric-card">
        <span>Active conflicts</span>
        <strong>{metrics.activeConflicts}</strong>
      </article>
      <article className="panel metric-card">
        <span>Countries at war</span>
        <strong>{metrics.countriesAtWar}</strong>
      </article>
      <article className="panel metric-card">
        <span>Global days without war</span>
        <strong>{metrics.globalDaysWithoutWar}</strong>
      </article>
      <article className="panel metric-card">
        <span>Selected country conflicts</span>
        <strong>{metrics.selectedCountryConflicts}</strong>
      </article>
      <article className="panel metric-card">
        <span>Total conflicts</span>
        <strong>{metrics.totalConflicts}</strong>
      </article>
    </section>
  )
}
