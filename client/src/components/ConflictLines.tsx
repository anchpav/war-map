import type { Conflict } from '../types'

type ConflictLinesProps = {
  conflicts: Conflict[]
  centroids: Map<string, [number, number]>
  onHoverText: (text: string) => void
}

/**
 * Draw tactical curved routes between countries.
 * Missing countries are skipped to keep rendering resilient.
 */
function buildCurvePath(from: [number, number], to: [number, number]): string {
  const controlX = (from[0] + to[0]) / 2
  const controlY = (from[1] + to[1]) / 2 - 22
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

        return (
          <path
            key={`${conflict.country}-${conflict.opponent}-${index}`}
            d={buildCurvePath(from, to)}
            className={`conflict-line ${conflict.active === false ? 'historical' : 'active'}`}
            onMouseEnter={() => onHoverText(`${conflict.country} vs ${conflict.opponent}`)}
            onMouseLeave={() => onHoverText('')}
          />
        )
      })}
    </g>
  )
}
