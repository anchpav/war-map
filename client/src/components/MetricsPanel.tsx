import type { Metrics } from '../types'

type MetricsPanelProps = {
  metrics: Metrics
}

/** Read-only metrics cards shown above the map. */
export function MetricsPanel({ metrics }: MetricsPanelProps) {
  return (
    <section className="metrics-grid">
      <article className="panel metric-card">
        <span>Total conflicts</span>
        <strong>{metrics.totalConflicts}</strong>
      </article>
      <article className="panel metric-card">
        <span>Active conflicts</span>
        <strong>{metrics.activeConflicts}</strong>
      </article>
      <article className="panel metric-card">
        <span>Days without war (world)</span>
        <strong>{metrics.daysWithoutWarWorld}</strong>
      </article>
      <article className="panel metric-card">
        <span>Days without war (selected)</span>
        <strong>{metrics.daysWithoutWarSelected}</strong>
      </article>
    </section>
  )
}
