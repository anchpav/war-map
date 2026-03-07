import * as d3 from 'd3'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { GeoProjection, GeoPermissibleObjects } from 'd3-geo'
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
type Tooltip = { visible: boolean; x: number; y: number; text: string }

/**
 * Watch map container size so SVG and projection always match available space.
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
        width: Math.max(320, entry.contentRect.width),
        height: Math.max(420, entry.contentRect.width * 0.56)
      })
    })

    observer.observe(ref.current)
    return () => observer.disconnect()
  }, [])

  return { ref, size }
}

/**
 * Read country label from GeoJSON properties.
 * Use ADMIN first, then name, then a safe fallback.
 */
function getCountryName(feature: any): string {
  return String(feature?.properties?.ADMIN ?? feature?.properties?.name ?? 'Unknown')
}

export function WorldMap({ geoData, conflicts, selectedCountry, onSelectCountry, onHoverText }: WorldMapProps) {
  const { ref, size } = useContainerSize()
  const svgRef = useRef<SVGSVGElement | null>(null)
  const countriesLayerRef = useRef<SVGGElement | null>(null)
  const [tooltip, setTooltip] = useState<Tooltip>({ visible: false, x: 0, y: 0, text: '' })

  // Correct projection: use fitSize so full world geometry fills current SVG area.
  const projection: GeoProjection = useMemo(() => {
    return d3.geoMercator().fitSize([size.width, size.height], geoData as GeoPermissibleObjects)
  }, [geoData, size.width, size.height])

  const pathBuilder = useMemo(() => d3.geoPath(projection), [projection])

  useEffect(() => {
    if (!svgRef.current) return

    if (!countriesLayerRef.current) return

    const countriesLayer = d3.select(countriesLayerRef.current)

    // Draw all countries from GeoJSON in one clear D3 data-binding step.
    countriesLayer
      .selectAll<SVGPathElement, any>('path.country-shape')
      .data(geoData.features)
      .join('path')
      .attr('class', (feature) => {
        const countryName = getCountryName(feature)
        return `country country-shape ${selectedCountry === countryName ? 'selected' : ''}`
      })
      .attr('d', (feature) => pathBuilder(feature as GeoPermissibleObjects) ?? '')
      .on('mouseenter', (event, feature) => {
        const countryName = getCountryName(feature)
        onHoverText(countryName)
        setTooltip({ visible: true, x: event.offsetX + 12, y: event.offsetY + 12, text: countryName })
      })
      .on('mousemove', (event) => {
        setTooltip((prev) => ({ ...prev, x: event.offsetX + 12, y: event.offsetY + 12 }))
      })
      .on('mouseleave', () => {
        onHoverText('')
        setTooltip({ visible: false, x: 0, y: 0, text: '' })
      })
      .on('click', (_event, feature) => {
        onSelectCountry(getCountryName(feature))
      })
  }, [geoData, pathBuilder, selectedCountry, onHoverText, onSelectCountry])

  function project(coords: [number, number]): [number, number] | null {
    const point = projection(coords)
    return point ? [point[0], point[1]] : null
  }

  return (
    <div ref={ref} className="panel map-panel" style={{ position: 'relative' }}>
      {/* SVG fills container size for responsive map scaling. */}
      <svg ref={svgRef} width={size.width} height={size.height} className="world-svg">
        <g ref={countriesLayerRef} />
        <ConflictLines conflicts={conflicts} project={project} onHoverText={onHoverText} />
      </svg>

      {tooltip.visible && (
        <div
          style={{
            position: 'absolute',
            left: tooltip.x,
            top: tooltip.y,
            pointerEvents: 'none',
            background: 'rgba(15, 23, 42, 0.95)',
            border: '1px solid #475569',
            borderRadius: 6,
            padding: '4px 8px',
            fontSize: 12,
            color: '#e2e8f0'
          }}
        >
          {tooltip.text}
        </div>
      )}
    </div>
  )
}
