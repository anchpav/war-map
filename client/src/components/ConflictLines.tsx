import { geoCentroid } from 'd3-geo'
import type { GeoProjection } from 'd3-geo'
import type { Conflict } from '../types'

type ConflictLinesProps = {
  conflicts: Conflict[]
  projection: GeoProjection
  features: any[]
  onHoverConflict: (text: string) => void
  onLeaveConflict: () => void
}

function centroidByCountry(features: any[], projection: GeoProjection, country: string): [number, number] | null {
  const feature = features.find((item) => item.properties?.name === country)
  if (!feature) return null

  const [lon, lat] = geoCentroid(feature)
  const point = projection([lon, lat])
  if (!point) return null

  return [point[0], point[1]]
}

export function ConflictLines({ conflicts, projection, features, onHoverConflict, onLeaveConflict }: ConflictLinesProps) {
  const activeConflicts = conflicts.filter((conflict) => conflict.active)

  return (
    <g>
      {activeConflicts.map((conflict) => {
        const [countryA, countryB] = conflict.countries
        const from = centroidByCountry(features, projection, countryA)
        const to = centroidByCountry(features, projection, countryB)
        if (!from || !to) return null

        return (
          <line
            key={conflict.id}
            className="conflict-line"
            x1={from[0]}
            y1={from[1]}
            x2={to[0]}
            y2={to[1]}
            onMouseEnter={() => onHoverConflict(`${conflict.name}: ${countryA} vs ${countryB}`)}
            onMouseLeave={onLeaveConflict}
          />
        )
      })}
    </g>
  )
}
