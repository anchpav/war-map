import { geoCentroid, geoMercator, geoPath, type GeoPermissibleObjects } from 'd3-geo'
import { select } from 'd3-selection'
import { zoom, zoomIdentity, type ZoomBehavior, type ZoomTransform } from 'd3-zoom'
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
type CountryLabel = {
  name: string
  x: number
  y: number
  area: number
  isConflict: boolean
  isSelected: boolean
}

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

/**
 * Smart label rule:
 * - low zoom: hide all labels
 * - medium zoom: only conflict-country labels
 * - high zoom: conflict labels + faint non-conflict labels
 */
function shouldShowLabel(zoomLevel: number, isConflict: boolean): boolean {
  if (zoomLevel <= 1.8) return false
  if (zoomLevel <= 3.4) return isConflict
  return true
}

/**
 * Keep labels readable by dropping nearby collisions.
 * Conflict and selected-country labels are prioritized first.
 */
function filterLabelOverlap(labels: CountryLabel[], zoomLevel: number): CountryLabel[] {
  const minDistance = zoomLevel <= 3.4 ? 26 : 18
  const accepted: CountryLabel[] = []

  for (const label of labels) {
    const isOverlapping = accepted.some((placed) => {
      const dx = placed.x - label.x
      const dy = placed.y - label.y
      return Math.hypot(dx, dy) < minDistance
    })

    if (!isOverlapping) accepted.push(label)
  }

  return accepted
}

export function WorldMap({ geoData, conflicts, selectedCountry, onSelectCountry, onHoverText, resetSignal }: WorldMapProps) {
  const { ref, size } = useContainerSize()
  const svgRef = useRef<SVGSVGElement | null>(null)
  const zoomLayerRef = useRef<SVGGElement | null>(null)
  const countriesLayerRef = useRef<SVGGElement | null>(null)
  const zoomRef = useRef<ZoomBehavior<SVGSVGElement, unknown> | null>(null)
  const autoZoomedCountryRef = useRef('')
  const zoomTransformRef = useRef<ZoomTransform>(zoomIdentity)

  const [zoomLevel, setZoomLevel] = useState(1)
  const [tooltip, setTooltip] = useState<Tooltip>({ x: 0, y: 0, text: '', visible: false })
  const [retroMode, setRetroMode] = useState(false)
  const [patrolStep, setPatrolStep] = useState(0)

  // Projection keeps the full world visible and responsive to panel size.
  const projection = useMemo(
    () => geoMercator().fitSize([size.width, size.height], geoData as GeoPermissibleObjects),
    [geoData, size.width, size.height]
  )

  // geoPath converts country geometry to SVG paths.
  const pathBuilder = useMemo(() => geoPath(projection), [projection])
  const heatMap = useMemo(() => buildHeatMap(conflicts), [conflicts])

  // Conflict-country set is memoized for label visibility priority and performance.
  const conflictCountries = useMemo(() => {
    const set = new Set<string>()
    conflicts.forEach((conflict) => {
      set.add(conflict.country)
      set.add(conflict.opponent)
    })
    return set
  }, [conflicts])

  // Reused projected points for conflict lines, labels, and retro patrol.
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

  const labels = useMemo(() => {
    return geoData.features
      .map((feature) => {
        const name = getCountryName(feature)
        const point = centroids.get(name)
        if (!point) return null

        const bounds = pathBuilder.bounds(feature as GeoPermissibleObjects)
        const width = Math.max(0, bounds[1][0] - bounds[0][0])
        const height = Math.max(0, bounds[1][1] - bounds[0][1])
        const area = width * height

        return {
          name,
          x: point[0],
          y: point[1],
          area,
          isConflict: conflictCountries.has(name),
          isSelected: selectedCountry === name
        }
      })
      .filter((label): label is CountryLabel => label !== null)
  }, [geoData, centroids, pathBuilder, size.width, size.height, conflictCountries, selectedCountry])

  const visibleLabels = useMemo(() => {
    const allowed = labels
      .filter((label) => shouldShowLabel(zoomLevel, label.isConflict))
      .sort((a, b) => {
        const aPriority = (a.isSelected ? 4 : 0) + (a.isConflict ? 2 : 0)
        const bPriority = (b.isSelected ? 4 : 0) + (b.isConflict ? 2 : 0)
        if (aPriority !== bPriority) return bPriority - aPriority
        return b.area - a.area
      })

    return filterLabelOverlap(allowed, zoomLevel)
  }, [labels, zoomLevel])

  const activeRoutes = useMemo(() => {
    return conflicts
      .filter((conflict) => conflict.active !== false)
      .map((conflict) => {
        const from = centroids.get(conflict.country)
        const to = centroids.get(conflict.opponent)
        if (!from || !to) return null
        return { from, to }
      })
      .filter((route): route is { from: [number, number]; to: [number, number] } => route !== null)
  }, [conflicts, centroids])

  useEffect(() => {
    if (!retroMode || activeRoutes.length === 0) return

    const timer = window.setInterval(() => {
      setPatrolStep((prev) => (prev + 1) % (activeRoutes.length * 22))
    }, 130)

    return () => window.clearInterval(timer)
  }, [retroMode, activeRoutes.length])

  const selectedPoint = useMemo(() => {
    if (!selectedCountry) return null
    return centroids.get(selectedCountry) ?? null
  }, [selectedCountry, centroids])

  const patrolPoint = useMemo(() => {
    if (!retroMode || activeRoutes.length === 0) return null

    const routeIndex = Math.floor(patrolStep / 22) % activeRoutes.length
    const progress = (patrolStep % 22) / 21
    const route = activeRoutes[routeIndex]

    return {
      x: route.from[0] + (route.to[0] - route.from[0]) * progress,
      y: route.from[1] + (route.to[1] - route.from[1]) * progress,
      routeIndex: routeIndex + 1,
      routeCount: activeRoutes.length
    }
  }, [retroMode, activeRoutes, patrolStep])

  useEffect(() => {
    if (!svgRef.current || !zoomLayerRef.current) return

    const svg = select(svgRef.current)
    const zoomLayer = select(zoomLayerRef.current)

    // Zoom state drives transform and smart label density.
    const behavior = zoom<SVGSVGElement, unknown>()
      .scaleExtent([1, 8])
      // Tactical navigation: keep wheel zoom, disable drag-based pan.
      .filter((event: any) => event.type === 'wheel')
      .on('zoom', (event) => {
        zoomLayer.attr('transform', event.transform)
        zoomTransformRef.current = event.transform
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

  // Auto-zoom exactly once per newly selected country, then stay stable.
  // This prevents repeated repositioning during unrelated re-renders.
  useEffect(() => {
    if (!selectedCountry) {
      autoZoomedCountryRef.current = ''
      return
    }

    if (!svgRef.current || !zoomRef.current) return
    if (autoZoomedCountryRef.current === selectedCountry) return

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

    autoZoomedCountryRef.current = selectedCountry
    const nextTransform = zoomIdentity.translate(tx, ty).scale(scale)
    zoomTransformRef.current = nextTransform
    select(svgRef.current).call(zoomRef.current.transform as any, nextTransform)
  }, [selectedCountry, geoData, pathBuilder, size.width, size.height])

  useEffect(() => {
    if (!svgRef.current || !zoomRef.current) return
    autoZoomedCountryRef.current = ''
    zoomTransformRef.current = zoomIdentity
    select(svgRef.current).call(zoomRef.current.transform as any, zoomIdentity)
  }, [resetSignal])

  useEffect(() => {
    if (!svgRef.current || !zoomRef.current) return

    const svgNode = svgRef.current

    // Click-to-center navigation (no drag panning):
    // convert screen click into world coordinates, then recenter at current zoom scale.
    const onSvgClick = (event: MouseEvent) => {
      const target = event.target as Element | null
      if (target?.closest('.country-shape')) return

      const rect = svgNode.getBoundingClientRect()
      const clickX = event.clientX - rect.left
      const clickY = event.clientY - rect.top
      const current = zoomTransformRef.current

      const worldX = (clickX - current.x) / current.k
      const worldY = (clickY - current.y) / current.k
      const tx = size.width / 2 - current.k * worldX
      const ty = size.height / 2 - current.k * worldY

      const start = zoomTransformRef.current
      const targetTransform = zoomIdentity.translate(tx, ty).scale(current.k)
      const startTime = performance.now()
      const duration = 500

      const animate = (now: number) => {
        const t = Math.min(1, (now - startTime) / duration)
        const eased = 1 - Math.pow(1 - t, 3)
        const stepTransform = zoomIdentity
          .translate(start.x + (targetTransform.x - start.x) * eased, start.y + (targetTransform.y - start.y) * eased)
          .scale(current.k)

        select(svgNode).call(zoomRef.current!.transform as any, stepTransform)
        if (t < 1) requestAnimationFrame(animate)
      }

      requestAnimationFrame(animate)
    }

    svgNode.addEventListener('click', onSvgClick)
    return () => svgNode.removeEventListener('click', onSvgClick)
  }, [size.width, size.height])

  return (
    <section className="panel map-panel" ref={ref}>
      <button type="button" className={`retro-toggle ${retroMode ? 'active' : ''}`} onClick={() => setRetroMode((v) => !v)}>
        {retroMode ? '8-bit ON' : '8-bit'}
      </button>

      <svg ref={svgRef} className="world-svg" width={size.width} height={size.height} role="img" aria-label="World conflict map">
        <g ref={zoomLayerRef}>
          <rect className="ocean" width={size.width} height={size.height} />
          <g ref={countriesLayerRef} />
          <ConflictLines conflicts={conflicts} centroids={centroids} onHoverText={onHoverText} />

          <g>
            {visibleLabels.map((label) => (
              <text key={label.name} x={label.x} y={label.y} className={`country-label ${label.isConflict ? 'conflict-label' : 'non-conflict-label'} ${label.isSelected ? 'selected-label' : ''}`}>
                {label.name}
              </text>
            ))}
          </g>

          {selectedPoint && (
            <g className="target-reticle">
              <circle cx={selectedPoint[0]} cy={selectedPoint[1]} r={9} className="target-ring" />
              <circle cx={selectedPoint[0]} cy={selectedPoint[1]} r={3} className="target-core" />
            </g>
          )}

          {patrolPoint && (
            <g>
              <rect x={patrolPoint.x - 3} y={patrolPoint.y - 3} width={6} height={6} className="pixel-drone" />
              <rect x={patrolPoint.x - 1} y={patrolPoint.y - 8} width={2} height={2} className="pixel-drone" />
            </g>
          )}
        </g>
      </svg>

      {patrolPoint && <div className="retro-status">Patrol {patrolPoint.routeIndex}/{patrolPoint.routeCount}</div>}

      {tooltip.visible && (
        <div className="map-tooltip" style={{ left: tooltip.x, top: tooltip.y }}>
          {tooltip.text}
        </div>
      )}
    </section>
  )
}
