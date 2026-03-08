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
  resetSignal: number
}

type Size = { width: number; height: number }
type Tooltip = { x: number; y: number; text: string; visible: boolean }

function getCountryName(feature: any): string {
  return String(feature?.properties?.ADMIN ?? feature?.properties?.name ?? 'Unknown')
}

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

function buildHeatMap(conflicts: Conflict[]) {
  const heat = new Map<string, number>()
  conflicts.forEach((conflict) => {
    heat.set(conflict.country, (heat.get(conflict.country) ?? 0) + 1)
    heat.set(conflict.opponent, (heat.get(conflict.opponent) ?? 0) + 1)
  })
  return heat
}

export function WorldMap({ geoData, conflicts, selectedCountry, onSelectCountry, onHoverText, resetSignal }: WorldMapProps) {
  const { ref, size } = useContainerSize()
  const svgRef = useRef<SVGSVGElement | null>(null)
  const countriesLayerRef = useRef<SVGGElement | null>(null)
  const labelsLayerRef = useRef<SVGGElement | null>(null)
  const zoomLayerRef = useRef<SVGGElement | null>(null)
  const zoomRef = useRef<ZoomBehavior<SVGSVGElement, unknown> | null>(null)
  const [zoomLevel, setZoomLevel] = useState(1)
  const [tooltip, setTooltip] = useState<Tooltip>({ x: 0, y: 0, text: '', visible: false })

  // Use fitSize for reliable full-world projection.
  const projection = useMemo(
    () => d3.geoMercator().fitSize([size.width, size.height], geoData as GeoPermissibleObjects),
    [geoData, size.width, size.height]
  )

  const pathBuilder = useMemo(() => d3.geoPath(projection), [projection])
  const heatMap = useMemo(() => buildHeatMap(conflicts), [conflicts])

  const centroids = useMemo(() => {
    const map = new Map<string, [number, number]>()
    geoData.features.forEach((feature: any) => {
      const name = getCountryName(feature)
      const [lon, lat] = geoCentroid(feature)
      const point = projection([lon, lat])
      if (point) map.set(name, [point[0], point[1]])
    })
    return map
  }, [geoData, projection])

  // Zoom + pan behavior. Labels are shown only after enough zoom.
  useEffect(() => {
    if (!svgRef.current || !zoomLayerRef.current) return

    const svg = d3.select(svgRef.current)
    const zoomLayer = d3.select(zoomLayerRef.current)

    const behavior = zoom<SVGSVGElement, unknown>()
      .scaleExtent([1, 8])
      .on('zoom', (event: any) => {
        zoomLayer.attr('transform', event.transform)
        setZoomLevel(event.transform.k)
      })

    zoomRef.current = behavior
    svg.call(behavior)
  }, [])

  useEffect(() => {
    if (!countriesLayerRef.current || !labelsLayerRef.current) return

    const countriesLayer = d3.select(countriesLayerRef.current)
    const labelsLayer = d3.select(labelsLayerRef.current)

    countriesLayer
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
      .on('mouseenter', (event: any, feature: any) => {
        const name = getCountryName(feature)
        onHoverText(name)
        setTooltip({ x: event.offsetX + 10, y: event.offsetY + 10, text: name, visible: true })
      })
      .on('mousemove', (event: any) => {
        setTooltip((prev) => ({ ...prev, x: event.offsetX + 10, y: event.offsetY + 10 }))
      })
      .on('mouseleave', () => {
        onHoverText('')
        setTooltip((prev) => ({ ...prev, visible: false }))
      })
      .on('click', (_event: any, feature: any) => onSelectCountry(getCountryName(feature)))

    labelsLayer
      .selectAll<SVGTextElement, any>('text.country-label')
      .data(geoData.features)
      .join('text')
      .attr('class', 'country-label')
      .text((feature: any) => getCountryName(feature))
      .attr('x', (feature: any) => {
        const [lon, lat] = geoCentroid(feature)
        const point = projection([lon, lat])
        return point ? point[0] : -9999
      })
      .attr('y', (feature: any) => {
        const [lon, lat] = geoCentroid(feature)
        const point = projection([lon, lat])
        return point ? point[1] : -9999
      })
      .style('display', zoomLevel > 2 ? 'block' : 'none')
      .style('pointer-events', 'none')
  }, [geoData, projection, pathBuilder, conflicts, selectedCountry, heatMap, zoomLevel, onSelectCountry, onHoverText])

  // Search selection: zoom to exact country bounds for better focus.
  useEffect(() => {
    if (!selectedCountry || !svgRef.current || !zoomRef.current) return

    const feature = geoData.features.find((item: any) => getCountryName(item) === selectedCountry)
    if (!feature) return

    const [[x0, y0], [x1, y1]] = pathBuilder.bounds(feature)
    const dx = Math.max(1, x1 - x0)
    const dy = Math.max(1, y1 - y0)
    const scale = Math.max(1, Math.min(8, 0.9 / Math.max(dx / size.width, dy / size.height)))
    const translateX = size.width / 2 - scale * (x0 + x1) / 2
    const translateY = size.height / 2 - scale * (y0 + y1) / 2

    const target = zoomIdentity.translate(translateX, translateY).scale(scale)
    d3.select(svgRef.current).transition().duration(450).call(zoomRef.current.transform as any, target)
  }, [selectedCountry, geoData, pathBuilder, size.width, size.height])

  // Keyboard shortcut R triggers map reset.
  useEffect(() => {
    if (!svgRef.current || !zoomRef.current) return
    d3.select(svgRef.current).transition().duration(350).call(zoomRef.current.transform as any, zoomIdentity)
  }, [resetSignal])

  return (
    <div ref={ref} className="panel map-panel">
      <svg ref={svgRef} width={size.width} height={size.height} className="world-svg">
        <rect x={0} y={0} width={size.width} height={size.height} className="ocean" />
        <g ref={zoomLayerRef}>
          <g ref={countriesLayerRef} />
          <g ref={labelsLayerRef} />
          <ConflictLines conflicts={conflicts} centroids={centroids} onHoverText={onHoverText} />
        </g>
      </svg>

      {tooltip.visible && (
        <div className="map-tooltip" style={{ left: tooltip.x, top: tooltip.y }}>
          {tooltip.text}
        </div>
      )}
    </div>
  )
}
