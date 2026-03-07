import * as d3 from 'd3'
import { geoCentroid, type GeoPermissibleObjects } from 'd3-geo'
import { zoom, zoomIdentity, type ZoomBehavior } from 'd3-zoom'
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

function getCountryName(feature: any): string {
  return String(feature?.properties?.ADMIN ?? feature?.properties?.name ?? 'Unknown')
}

/** Track container size for responsive projection. */
function useContainerSize() {
  const ref = useRef<HTMLDivElement | null>(null)
  const [size, setSize] = useState<Size>({ width: 1100, height: 620 })

  useEffect(() => {
    if (!ref.current) return
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (!entry) return
      setSize({ width: Math.max(320, entry.contentRect.width), height: Math.max(420, entry.contentRect.width * 0.56) })
    })
    observer.observe(ref.current)
    return () => observer.disconnect()
  }, [])

  return { ref, size }
}

/** Build simple conflict heat score per country. */
function buildHeatMap(conflicts: Conflict[]) {
  const heat = new Map<string, number>()
  conflicts.forEach((conflict) => {
    heat.set(conflict.country, (heat.get(conflict.country) ?? 0) + 1)
    heat.set(conflict.opponent, (heat.get(conflict.opponent) ?? 0) + 1)
  })
  return heat
}

export function WorldMap({ geoData, conflicts, selectedCountry, onSelectCountry, onHoverText }: WorldMapProps) {
  const { ref, size } = useContainerSize()
  const svgRef = useRef<SVGSVGElement | null>(null)
  const countriesLayerRef = useRef<SVGGElement | null>(null)
  const zoomLayerRef = useRef<SVGGElement | null>(null)
  const zoomRef = useRef<ZoomBehavior<SVGSVGElement, unknown> | null>(null)

  // Fit map to available area.
  const projection = useMemo(
    () => d3.geoMercator().fitSize([size.width, size.height], geoData as GeoPermissibleObjects),
    [geoData, size.width, size.height]
  )

  const pathBuilder = useMemo(() => d3.geoPath(projection), [projection])
  const heatMap = useMemo(() => buildHeatMap(conflicts), [conflicts])

  // Centroids are used for conflict lines and optional zoom-to-country behavior.
  const centroids = useMemo(() => {
    const map = new Map<string, [number, number]>()
    geoData.features.forEach((feature: any) => {
      const name = getCountryName(feature)
      const [lon, lat] = geoCentroid(feature)
      const projected = projection([lon, lat])
      if (projected) map.set(name, [projected[0], projected[1]])
    })
    return map
  }, [geoData, projection])

  // Attach D3 zoom and pan once.
  useEffect(() => {
    if (!svgRef.current || !zoomLayerRef.current) return

    const svg = d3.select(svgRef.current)
    const zoomLayer = d3.select(zoomLayerRef.current)

    const zoomBehavior = zoom<SVGSVGElement, unknown>()
      .scaleExtent([1, 8])
      .on('zoom', (event: any) => {
        zoomLayer.attr('transform', event.transform)
      })

    zoomRef.current = zoomBehavior
    svg.call(zoomBehavior)
  }, [])

  // Draw countries + labels with conflict and heat classes.
  useEffect(() => {
    if (!countriesLayerRef.current) return

    const layer = d3.select(countriesLayerRef.current)

    layer
      .selectAll<SVGPathElement, any>('path.country-shape')
      .data(geoData.features)
      .join('path')
      .attr('class', (feature: any) => {
        const name = getCountryName(feature)
        const isConflict = conflicts.some((c) => c.country === name || c.opponent === name)
        const isSelected = selectedCountry === name
        const count = heatMap.get(name) ?? 0
        const heatClass = count >= 3 ? 'heat-3' : count >= 2 ? 'heat-2' : count >= 1 ? 'heat-1' : ''
        return `country country-shape ${isConflict ? 'conflict' : ''} ${isSelected ? 'selected' : ''} ${heatClass}`.trim()
      })
      .attr('d', (feature: any) => pathBuilder(feature as GeoPermissibleObjects) ?? '')
      .on('mouseenter', (_event: any, feature: any) => onHoverText(getCountryName(feature)))
      .on('mouseleave', () => onHoverText(''))
      .on('click', (_event: any, feature: any) => onSelectCountry(getCountryName(feature)))

    layer
      .selectAll<SVGTextElement, any>('text.country-label')
      .data(geoData.features)
      .join('text')
      .attr('class', 'country-label')
      .text((feature: any) => getCountryName(feature))
      .attr('x', (feature: any) => {
        const [lon, lat] = geoCentroid(feature)
        const p = projection([lon, lat])
        return p ? p[0] : -9999
      })
      .attr('y', (feature: any) => {
        const [lon, lat] = geoCentroid(feature)
        const p = projection([lon, lat])
        return p ? p[1] : -9999
      })
      .style('pointer-events', 'none')
  }, [geoData, projection, pathBuilder, conflicts, selectedCountry, heatMap, onHoverText, onSelectCountry])

  // When country is selected in search, zoom to that country centroid.
  useEffect(() => {
    if (!selectedCountry || !svgRef.current || !zoomRef.current) return

    const center = centroids.get(selectedCountry)
    if (!center) return

    const target = zoomIdentity.translate(size.width / 2 - center[0] * 2.5, size.height / 2 - center[1] * 2.5).scale(2.5)
    d3.select(svgRef.current).transition().duration(450).call(zoomRef.current.transform as any, target)
  }, [selectedCountry, centroids, size.width, size.height])

  return (
    <div ref={ref} className="panel map-panel">
      <svg ref={svgRef} width={size.width} height={size.height} className="world-svg">
        <rect x={0} y={0} width={size.width} height={size.height} className="ocean" />
        <g ref={zoomLayerRef}>
          <g ref={countriesLayerRef} />
          <ConflictLines conflicts={conflicts} centroids={centroids} onHoverText={onHoverText} />
        </g>
      </svg>
    </div>
  )
}
