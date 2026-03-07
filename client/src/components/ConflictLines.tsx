import { line, curveBasis } from 'd3-shape'
import type { Conflict } from '../types'

type ConflictLinesProps = {
  conflicts: Conflict[]
  centroids: Map<string, [number, number]>
  onHoverText: (text: string) => void
}

/**
 * Draw curved animated lines between conflict sides.
 * Unknown countries are skipped to keep rendering stable.
 */
export function ConflictLines({ conflicts, centroids, onHoverText }: ConflictLinesProps) {
  return (
    <g>
      {conflicts.map((conflict, index) => {
        const from = centroids.get(conflict.country)
        const to = centroids.get(conflict.opponent)

        if (!from || !to) {
          console.warn(`Skipping conflict with unknown country: ${conflict.country} -> ${conflict.opponent}`)
          return null
        }

        const control: [number, number] = [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2 - 20]

        const pathData = line<[number, number]>()
          .curve(curveBasis)
          .x((point: [number, number]) => point[0])
          .y((point: [number, number]) => point[1])([from, control, to])

        return (
          <path
            key={`${conflict.country}-${conflict.opponent}-${index}`}
            d={pathData ?? undefined}
            className={`conflict-line ${conflict.active ? 'active' : 'historical'}`}
            onMouseEnter={() => onHoverText(`${conflict.country} vs ${conflict.opponent}`)}
            onMouseLeave={() => onHoverText('')}
          />
        )
      })}
    </g>
  )
}
