import { geoMercator, geoPath, type GeoProjection, type GeoPermissibleObjects } from 'd3-geo'
import { zoom, zoomIdentity, type D3ZoomEvent } from 'd3-zoom'
import { select } from 'd3-selection'
import { useEffect, useMemo, useRef, useState } from 'react'
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

function useContainerSize() {
  const ref = useRef<HTMLDivElement | null>(null)
  const [size, setSize] = useState<Size>({ width: 1000, height: 560 })

  useEffect(() => {
    if (!ref.current) return

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (!entry) return

      setSize({
        width: entry.contentRect.width,
        height: Math.max(420, entry.contentRect.width * 0.56)
      })
    })

    observer.observe(ref.current)
    return () => observer.disconnect()
  }, [])

  return { ref, size }
}

export function WorldMap({
  geoData,
  conflicts,
  selectedCountry,
  onSelectCountry,
  onHoverText
}: WorldMapProps) {
  const { ref, size } = useContainerSize()
  const svgRef = useRef<SVGSVGElement | null>(null)
  const zoomBehaviorRef = useRef<any>(null)
  const [zoomLevel, setZoomLevel] = useState(1)

  const projection: GeoProjection = useMemo(() => {
    return geoMercator().fitSize(
      [size.width, size.height],
      geoData as GeoPermissibleObjects
    )
  }, [geoData, size])

  const pathBuilder = useMemo(() => geoPath(projection), [projection])

  const conflictCountries = useMemo(() => {
    const set = new Set<string>()

    for (const item of conflicts) {
      if (item.country) set.add(item.country.toLowerCase())

      const opponentType = (item as any).opponentType
      if (item.opponent && (!opponentType || opponentType === 'state')) {
        set.add(item.opponent.toLowerCase())
      }
    }

    return set
  }, [conflicts])

  useEffect(() => {
    if (!svgRef.current) return

    const svg = select(svgRef.current)

    const zoomBehavior = zoom<SVGSVGElement, unknown>()
      .scaleExtent([1, 8])
      .filter((event: any) => {
        // Разрешаем только zoom колесом / trackpad.
        // Drag-pan мышью отключаем полностью.
        return event.type === 'wheel'
      })
      .on('zoom', (event: D3ZoomEvent<SVGSVGElement, unknown>) => {
        svg.select<SVGGElement>('g.map-layer').attr('transform', event.transform.toString())
        setZoomLevel(event.transform.k)
      })

    zoomBehaviorRef.current = zoomBehavior
    svg.call(zoomBehavior)
  }, [])

  function project(coords: [number, number]): [number, number] | null {
    const point = projection(coords)
    return point ? [point[0], point[1]] : null
  }

  function zoomToCountry(feature: any) {
    if (!svgRef.current || !zoomBehaviorRef.current) return

    const [[x0, y0], [x1, y1]] = pathBuilder.bounds(feature)

    const dx = x1 - x0
    const dy = y1 - y0
    const x = (x0 + x1) / 2
    const y = (y0 + y1) / 2

    const scale = Math.max(
      1,
      Math.min(8, 0.9 / Math.max(dx / size.width, dy / size.height))
    )

    const translateX = size.width / 2 - scale * x
    const translateY = size.height / 2 - scale * y

    select(svgRef.current)
      .transition()
      .duration(600)
      .call(
        zoomBehaviorRef.current.transform,
        zoomIdentity.translate(translateX, translateY).scale(scale)
      )
  }

  function shouldShowLabel(feature: any, countryName: string) {
    const isConflictCountry = conflictCountries.has(countryName.toLowerCase())
    if (!isConflictCountry) return false

    if (zoomLevel <= 1.2) return false

    const [[x0, y0], [x1, y1]] = pathBuilder.bounds(feature)
    const width = x1 - x0
    const height = y1 - y0
    const area = width * height

    if (zoomLevel > 3.5) return area > 120
    if (zoomLevel > 2.2) return area > 250
    return area > 700
  }

  return (
    <div ref={ref} className="panel map-panel">
      <svg
        ref={svgRef}
        width={size.width}
        height={size.height}
        className="world-svg"
      >
        <rect
          width={size.width}
          height={size.height}
          fill="#071b2b"
        />

        <g className="map-layer">
          {geoData.features.map((feature: any) => {
            const countryName =
              feature.properties?.name ||
              feature.properties?.ADMIN ||
              feature.properties?.NAME ||
              'Unknown'

            const centroid = pathBuilder.centroid(feature)
            const isSelected = selectedCountry === countryName
            const isConflictCountry = conflictCountries.has(countryName.toLowerCase())

            return (
              <g key={countryName}>
                <path
                  d={pathBuilder(feature) ?? undefined}
                  className={`country ${isSelected ? 'selected' : ''} ${isConflictCountry ? 'conflict-country' : ''}`}
                  onMouseEnter={() => onHoverText(countryName)}
                  onMouseLeave={() => onHoverText('')}
                  onClick={() => {
                    onSelectCountry(countryName)
                    zoomToCountry(feature)
                  }}
                />

                {centroid && shouldShowLabel(feature, countryName) && (
                  <text
                    x={centroid[0]}
                    y={centroid[1]}
                    className={`country-label ${isConflictCountry ? 'conflict-label' : ''}`}
                  >
                    {countryName}
                  </text>
                )}
              </g>
            )
          })}

          <ConflictLines
            conflicts={conflicts}
            project={project}
            onHoverText={onHoverText}
          />
        </g>
      </svg>
    </div>
  )
}
