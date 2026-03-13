import type { Conflict, OpponentType } from '../types'

type ConflictLinesProps = {
  conflicts: Conflict[]
  centroids: Map<string, [number, number]>
  onHoverText: (text: string) => void
}

function normalizeOpponentType(value?: OpponentType): OpponentType {
  return value === 'non-state' || value === 'proxy' ? value : 'state'
}

function routeStyle(type: OpponentType): { dashArray: string; color: string } {
  if (type === 'proxy') return { dashArray: '8 7', color: '#ff9f43' }
  if (type === 'non-state') return { dashArray: '2 6', color: '#facc15' }
  return { dashArray: '', color: '#ff4d4d' }
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
        const opponentType = normalizeOpponentType(conflict.opponentType)
        const style = routeStyle(opponentType)

        return (
          <g key={`${conflict.country}-${conflict.opponent}-${index}`}>
            <path d={pathData} className={`conflict-line-halo ${stateClass}`} style={{ stroke: style.color }} />
            <path
              d={pathData}
              className={`conflict-line ${stateClass}`}
              style={{ stroke: style.color, strokeDasharray: style.dashArray || undefined }}
              onMouseEnter={() => onHoverText(`${conflict.country} vs ${conflict.opponent} (${opponentType})`)}
              onMouseLeave={() => onHoverText('')}
            />
          </g>
        )
      })}
    </g>
  )
}
