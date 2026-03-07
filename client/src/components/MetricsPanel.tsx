import type { Metrics } from '../types'

type MetricsPanelProps = {
  metrics: Metrics
}

export function MetricsPanel({ metrics }: MetricsPanelProps) {
  return (
    <section className="metrics-grid">
      <div className="panel metric-card">
        <span>Total Conflicts</span>
        <strong>{metrics.totalConflicts}</strong>
      </div>
      <div className="panel metric-card">
        <span>Active Conflicts</span>
        <strong>{metrics.activeConflicts}</strong>
      </div>
      <div className="panel metric-card">
        <span>Days Without War (World)</span>
        <strong>{metrics.daysWithoutWarWorld}</strong>
      </div>
      <div className="panel metric-card">
        <span>Days Without War (Selected)</span>
        <strong>{metrics.daysWithoutWarSelected}</strong>
      </div>
    </section>
  )
}
