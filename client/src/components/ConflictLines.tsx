import type { Conflict } from '../types'

type ConflictLinesProps = {
  conflicts: Conflict[]
  centroids: Map<string, [number, number]>
  onHoverText: (text: string) => void
}

/**
 * Build a smooth tactical route between two projected points.
 * A quadratic curve keeps drawing lightweight and readable.
 */
function buildCurvePath(from: [number, number], to: [number, number]): string {
  const controlX = (from[0] + to[0]) / 2
  const controlY = (from[1] + to[1]) / 2 - 24
  return `M ${from[0]} ${from[1]} Q ${controlX} ${controlY} ${to[0]} ${to[1]}`
}

export function ConflictLines({ conflicts, centroids, onHoverText }: ConflictLinesProps) {
  return (
    <g>
      {conflicts.map((conflict, index) => {
        const from = centroids.get(conflict.country)
        const to = centroids.get(conflict.opponent)

        if (!from || !to) {
          console.warn(`Conflict skipped (country not found): ${conflict.country} -> ${conflict.opponent}`)
          return null
        }

        const pathData = buildCurvePath(from, to)
        const stateClass = conflict.active === false ? 'historical' : 'active'

        return (
          <g key={`${conflict.country}-${conflict.opponent}-${index}`}>
            <path d={pathData} className={`conflict-line-halo ${stateClass}`} />
            <path
              d={pathData}
              className={`conflict-line ${stateClass}`}
              onMouseEnter={() => onHoverText(`${conflict.country} vs ${conflict.opponent}`)}
              onMouseLeave={() => onHoverText('')}
            />
          </g>
        )
      })}
    </g>
  )
}
