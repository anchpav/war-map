import { geoMercator, geoPath, type GeoProjection, type GeoPermissibleObjects } from 'd3-geo'
import { useMemo, useRef, useState, useEffect } from 'react'
import type { Conflict } from '../types'
import { ConflictLines } from './ConflictLines'

type WorldMapProps = {
  geoData: any
  conflicts: Conflict[]
  selectedCountry: string
  onSelectCountry: (country: string) => void
  onHoverText: (text: string) => void
}

type Size = { width: number; height: number }

/**
 * Observe container size so the projection can scale to available space.
 */
function useContainerSize() {
  const ref = useRef<HTMLDivElement | null>(null)
  const [size, setSize] = useState<Size>({ width: 1000, height: 560 })

  useEffect(() => {
    if (!ref.current) return

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (!entry) return
      setSize({ width: entry.contentRect.width, height: Math.max(420, entry.contentRect.width * 0.56) })
    })

    observer.observe(ref.current)
    return () => observer.disconnect()
  }, [])

  return { ref, size }
}

export function WorldMap({ geoData, conflicts, selectedCountry, onSelectCountry, onHoverText }: WorldMapProps) {
  const { ref, size } = useContainerSize()

  // Build projection from GeoJSON so map fills the component area.
  const projection: GeoProjection = useMemo(() => {
    return geoMercator().fitSize([size.width, size.height], geoData as GeoPermissibleObjects)
  }, [geoData, size])

  const pathBuilder = useMemo(() => geoPath(projection), [projection])

  function project(coords: [number, number]): [number, number] | null {
    const point = projection(coords)
    return point ? [point[0], point[1]] : null
  }

  return (
    <div ref={ref} className="panel map-panel">
      <svg width={size.width} height={size.height} className="world-svg">
        <g>
          {geoData.features.map((feature: any) => {
            const countryName =
  feature.properties?.name ||
  feature.properties?.ADMIN ||
  feature.properties?.NAME ||
  'Unknown'
            return (
              <path
                key={countryName}
                d={pathBuilder(feature) ?? undefined}
                className={`country ${selectedCountry === countryName ? 'selected' : ''}`}
                onMouseEnter={() => onHoverText(countryName)}
                onMouseLeave={() => onHoverText('')}
                onClick={() => onSelectCountry(countryName)}
              />
            )
          })}

          <ConflictLines conflicts={conflicts} project={project} onHoverText={onHoverText} />
        </g>
      </svg>
    </div>
  )
}
