import { geoMercator, geoPath, type GeoProjection, type GeoPermissibleObjects } from 'd3-geo'
import { zoom, zoomIdentity } from 'd3-zoom'
import { select } from 'd3-selection'
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
 * Hook that observes container size
 * so the map projection scales responsively.
 */
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

  /**
   * Create map projection that automatically fits the world
   * into the SVG container.
   */
  const projection: GeoProjection = useMemo(() => {
    return geoMercator().fitSize(
      [size.width, size.height],
      geoData as GeoPermissibleObjects
    )
  }, [geoData, size])

  const pathBuilder = useMemo(() => geoPath(projection), [projection])

  /**
   * Enable zoom + pan interaction using d3-zoom.
   */
  useEffect(() => {
    if (!svgRef.current) return

    const svg = select(svgRef.current)

    const zoomBehavior = zoom<SVGSVGElement, unknown>()
      .scaleExtent([1, 8])
      .on("zoom", (event) => {
        svg.select("g").attr("transform", event.transform)
      })

    svg.call(zoomBehavior)

  }, [])

  /**
   * Convert geographic coordinates to screen coordinates.
   * Used for drawing conflict lines.
   */
  function project(coords: [number, number]): [number, number] | null {
    const point = projection(coords)
    return point ? [point[0], point[1]] : null
  }

  /**
   * Zoom the map to a specific country when clicked.
   */
  function zoomToCountry(feature: any) {

    if (!svgRef.current) return

    const [[x0, y0], [x1, y1]] = pathBuilder.bounds(feature)

    const dx = x1 - x0
    const dy = y1 - y0
    const x = (x0 + x1) / 2
    const y = (y0 + y1) / 2

    const scale = Math.max(
      1,
      Math.min(8, 0.9 / Math.max(dx / size.width, dy / size.height))
    )

    const translate = [
      size.width / 2 - scale * x,
      size.height / 2 - scale * y
    ]

    const svg = select(svgRef.current)

    svg
      .transition()
      .duration(750)
      .call(
        zoom().transform,
        zoomIdentity
          .translate(translate[0], translate[1])
          .scale(scale)
      )
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
  fill="#0b1f33"
/>
        <g>

          {geoData.features.map((feature: any) => {

            const countryName =
              feature.properties?.name ||
              feature.properties?.ADMIN ||
              feature.properties?.NAME ||
              "Unknown"

            return (
              <path
                key={countryName}
                d={pathBuilder(feature) ?? undefined}
                className={`country ${selectedCountry === countryName ? "selected" : ""}`}
                onMouseEnter={() => onHoverText(countryName)}
                onMouseLeave={() => onHoverText("")}
                onClick={() => {
                  onSelectCountry(countryName)
                  zoomToCountry(feature)
                }}
              />
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
