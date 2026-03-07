import { line, curveBasis } from 'd3-shape'
import type { Conflict } from '../types'

type ConflictLinesProps = {
  conflicts: Conflict[]
  project: (coords: [number, number]) => [number, number] | null
  onHoverText: (text: string) => void
}

/**
 * Draw animated conflict connections using curved dashed SVG paths.
 * Curves are easier to read than straight crossing lines.
 */
export function ConflictLines({ conflicts, project, onHoverText }: ConflictLinesProps) {
  const active = conflicts.filter((item) => item.end === null)

  return (
    <g>
      {active.map((item) => {
        const from = project([item.lon, item.lat])
        const to = project([item.opponentLon, item.opponentLat])
        if (!from || !to) return null

        const midpoint: [number, number] = [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2 - 20]

        const path = line<[number, number]>()
          .curve(curveBasis)
          .x((point) => point[0])
          .y((point) => point[1])([from, midpoint, to])

        return (
          <path
            key={item.id}
            d={path ?? undefined}
            className="conflict-line"
            onMouseEnter={() => onHoverText(`${item.country} vs ${item.opponent} • ${item.start}`)}
            onMouseLeave={() => onHoverText('')}
          />
        )
      })}
    </g>
  )
}
