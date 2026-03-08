import { line, curveBasis } from 'd3-shape'
import type { Conflict } from '../types'

type ConflictLinesProps = {
  conflicts: Conflict[]
  centroids: Map<string, [number, number]>
  onHoverText: (text: string) => void
}

/**
 * Draw curved SVG conflict paths.
 * If country is missing in GeoJSON we skip the line and print a warning.
 */
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

        const control: [number, number] = [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2 - 24]

        const pathData = line<[number, number]>()
          .curve(curveBasis)
          .x((point: [number, number]) => point[0])
          .y((point: [number, number]) => point[1])([from, control, to])

        return (
          <path
            key={`${conflict.country}-${conflict.opponent}-${index}`}
            d={pathData ?? undefined}
            className={`conflict-line ${conflict.active === false ? 'historical' : 'active'}`}
            onMouseEnter={() => onHoverText(`${conflict.country} vs ${conflict.opponent}`)}
            onMouseLeave={() => onHoverText('')}
          />
        )
      })}
    </g>
  )
}
