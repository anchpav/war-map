import type { Conflict } from '../types'

function daysSince(isoDate: string): number {
  const diffMs = Date.now() - new Date(isoDate).getTime()
  return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)))
}

export function getDaysWithoutWar(conflicts: Conflict[], country?: string): number {
  const scoped = country
    ? conflicts.filter((conflict) => conflict.countries.some((name) => name.toLowerCase() === country.toLowerCase()))
    : conflicts

  if (scoped.length === 0) return 0
  if (scoped.some((conflict) => conflict.active)) return 0

  const endedDates = scoped
    .map((conflict) => conflict.end_date)
    .filter((value): value is string => Boolean(value))

  if (endedDates.length === 0) return 0

  const mostRecent = endedDates.sort((a, b) => b.localeCompare(a))[0]
  return daysSince(mostRecent)
}

export function buildMetrics(conflicts: Conflict[], country?: string) {
  const scoped = country
    ? conflicts.filter((conflict) => conflict.countries.some((name) => name.toLowerCase() === country.toLowerCase()))
    : conflicts

  return {
    totalConflicts: scoped.length,
    activeConflicts: scoped.filter((conflict) => conflict.active).length,
    daysWithoutWarWorld: getDaysWithoutWar(conflicts),
    daysWithoutWarSelected: getDaysWithoutWar(conflicts, country)
  }
}
