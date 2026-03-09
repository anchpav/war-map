import { geoCentroid, geoMercator, geoPath, type GeoPermissibleObjects } from 'd3-geo'
import { select } from 'd3-selection'
import { zoom, zoomIdentity, type ZoomBehavior } from 'd3-zoom'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { Conflict, CountryFeatureCollection } from '../types'
import { getCountryName } from '../services/geoService'
import { ConflictLines } from './ConflictLines'

type WorldMapProps = {
  geoData: CountryFeatureCollection
  conflicts: Conflict[]
  selectedCountry: string
  onSelectCountry: (country: string) => void
  onHoverText: (text: string) => void
  resetSignal: number
}

type Size = { width: number; height: number }
type Tooltip = { x: number; y: number; text: string; visible: boolean }

const LABELS_ZOOM_THRESHOLD = 2

function useContainerSize() {
  const ref = useRef<HTMLDivElement | null>(null)
  const [size, setSize] = useState<Size>({ width: 1100, height: 620 })

  useEffect(() => {
    if (!ref.current) return

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (!entry) return

      setSize({
        width: Math.max(320, entry.contentRect.width),
        height: Math.max(360, entry.contentRect.width * 0.5)
      })
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
  const zoomLayerRef = useRef<SVGGElement | null>(null)
  const countriesLayerRef = useRef<SVGGElement | null>(null)
  const zoomRef = useRef<ZoomBehavior<SVGSVGElement, unknown> | null>(null)

  const [zoomLevel, setZoomLevel] = useState(1)
  const [tooltip, setTooltip] = useState<Tooltip>({ x: 0, y: 0, text: '', visible: false })

  // Projection fits GeoJSON into the map viewport for stable responsive rendering.
  const projection = useMemo(
    () => geoMercator().fitSize([size.width, size.height], geoData as GeoPermissibleObjects),
    [geoData, size.width, size.height]
  )

  // geoPath converts country polygons to SVG paths.
  const pathBuilder = useMemo(() => geoPath(projection), [projection])
  const heatMap = useMemo(() => buildHeatMap(conflicts), [conflicts])

  // We reuse projected centroids for conflict lines and label anchors.
  const centroids = useMemo(() => {
    const map = new Map<string, [number, number]>()

    geoData.features.forEach((feature) => {
      const name = getCountryName(feature)
      const [lon, lat] = geoCentroid(feature as GeoPermissibleObjects)
      const point = projection([lon, lat])
      if (point) map.set(name, [point[0], point[1]])
    })

    return map
  }, [geoData, projection])

  const countryLabels = useMemo(() => {
    return geoData.features
      .map((feature) => {
        const name = getCountryName(feature)
        const point = centroids.get(name)
        if (!point) return null
        return { name, x: point[0], y: point[1] }
      })
      .filter((label): label is { name: string; x: number; y: number } => label !== null)
  }, [geoData, centroids])

  useEffect(() => {
    if (!svgRef.current || !zoomLayerRef.current) return

    const svg = select(svgRef.current)
    const zoomLayer = select(zoomLayerRef.current)

    // Zoom handler updates SVG transform and zoom state for conditional labels.
    const behavior = zoom<SVGSVGElement, unknown>()
      .scaleExtent([1, 8])
      .on('zoom', (event) => {
        zoomLayer.attr('transform', event.transform)
        setZoomLevel(event.transform.k)
      })

    zoomRef.current = behavior
    svg.call(behavior)
  }, [])

  useEffect(() => {
    if (!countriesLayerRef.current) return

    const countriesLayer = select(countriesLayerRef.current)

    countriesLayer
      .selectAll<SVGPathElement, any>('path.country-shape')
      .data(geoData.features)
      .join('path')
      .attr('class', (feature: any) => {
        const name = getCountryName(feature)
        const isConflict = conflicts.some((c) => c.country === name || c.opponent === name)
        const isSelected = selectedCountry === name
        const count = heatMap.get(name) ?? 0
        const heatClass = count >= 3 ? 'heat-3' : count >= 1 ? 'heat-1' : ''
        return `country country-shape ${isConflict ? 'conflict' : ''} ${isSelected ? 'selected' : ''} ${heatClass}`.trim()
      })
      .attr('d', (feature: any) => pathBuilder(feature as GeoPermissibleObjects) ?? '')
      .on('mouseenter', (event: MouseEvent, feature: any) => {
        const name = getCountryName(feature)
        onHoverText(name)
        setTooltip({ x: event.offsetX + 10, y: event.offsetY + 10, text: name, visible: true })
      })
      .on('mousemove', (event: MouseEvent) => {
        setTooltip((prev) => ({ ...prev, x: event.offsetX + 10, y: event.offsetY + 10 }))
      })
      .on('mouseleave', () => {
        onHoverText('')
        setTooltip((prev) => ({ ...prev, visible: false }))
      })
      .on('click', (_event: MouseEvent, feature: any) => {
        onSelectCountry(getCountryName(feature))
      })
  }, [geoData, conflicts, selectedCountry, pathBuilder, heatMap, onHoverText, onSelectCountry])

  // Search replacement and map click both focus country bounds automatically.
  useEffect(() => {
    if (!selectedCountry || !svgRef.current || !zoomRef.current) return

    const target = geoData.features.find((feature) => getCountryName(feature) === selectedCountry)
    if (!target) return

    const bounds = pathBuilder.bounds(target as GeoPermissibleObjects)
    const dx = bounds[1][0] - bounds[0][0]
    const dy = bounds[1][1] - bounds[0][1]
    const x = (bounds[0][0] + bounds[1][0]) / 2
    const y = (bounds[0][1] + bounds[1][1]) / 2

    const scale = Math.max(1, Math.min(8, 0.9 / Math.max(dx / size.width, dy / size.height)))
    const tx = size.width / 2 - scale * x
    const ty = size.height / 2 - scale * y

    select(svgRef.current).call(zoomRef.current.transform as any, zoomIdentity.translate(tx, ty).scale(scale))
  }, [selectedCountry, geoData, pathBuilder, size.width, size.height])

  useEffect(() => {
    if (!svgRef.current || !zoomRef.current) return
    select(svgRef.current).call(zoomRef.current.transform as any, zoomIdentity)
  }, [resetSignal])

  return (
    <section className="panel map-panel" ref={ref}>
      <svg ref={svgRef} className="world-svg" width={size.width} height={size.height} role="img" aria-label="World conflict map">
        <g ref={zoomLayerRef}>
          <rect className="ocean" width={size.width} height={size.height} />
          <g ref={countriesLayerRef} />
          <ConflictLines conflicts={conflicts} centroids={centroids} onHoverText={onHoverText} />

          {/* Label rendering is gated by zoom to prevent overlap clutter. */}
          {zoomLevel > LABELS_ZOOM_THRESHOLD && (
            <g>
              {countryLabels.map((label) => (
                <text key={label.name} x={label.x} y={label.y} className="country-label">
                  {label.name}
                </text>
              ))}
            </g>
          )}
        </g>
      </svg>

      {tooltip.visible && (
        <div className="map-tooltip" style={{ left: tooltip.x, top: tooltip.y }}>
          {tooltip.text}
        </div>
      )}
    </section>
  )
}
