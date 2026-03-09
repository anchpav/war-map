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
type LabelSize = 'large' | 'medium' | 'small'

type CountryLabel = {
  name: string
  x: number
  y: number
  size: LabelSize
  area: number
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

    const opponentType = (conflict as any).opponentType
    if (!opponentType || opponentType === 'state') {
      heat.set(conflict.opponent, (heat.get(conflict.opponent) ?? 0) + 1)
    }
  })

  return heat
}

function shouldShowLabel(zoomLevel: number, size: LabelSize): boolean {
  if (zoomLevel <= 1.3) return false
  if (zoomLevel <= 2.4) return size === 'large'
  if (zoomLevel <= 4) return size === 'large' || size === 'medium'
  return true
}

function filterLabelOverlap(labels: CountryLabel[], zoomLevel: number): CountryLabel[] {
  const minDistance = zoomLevel <= 2.5 ? 26 : zoomLevel <= 4 ? 18 : 10
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

export function WorldMap({
  geoData,
  conflicts,
  selectedCountry,
  onSelectCountry,
  onHoverText,
  resetSignal
}: WorldMapProps) {
  const { ref, size } = useContainerSize()
  const svgRef = useRef<SVGSVGElement | null>(null)
  const zoomLayerRef = useRef<SVGGElement | null>(null)
  const countriesLayerRef = useRef<SVGGElement | null>(null)
  const zoomRef = useRef<ZoomBehavior<SVGSVGElement, unknown> | null>(null)

  const [zoomLevel, setZoomLevel] = useState(1)
  const [tooltip, setTooltip] = useState<Tooltip>({ x: 0, y: 0, text: '', visible: false })
  const [retroMode, setRetroMode] = useState(false)
  const [patrolStep, setPatrolStep] = useState(0)

  const projection = useMemo(
    () => geoMercator().fitSize([size.width, size.height], geoData as GeoPermissibleObjects),
    [geoData, size.width, size.height]
  )

  const pathBuilder = useMemo(() => geoPath(projection), [projection])
  const heatMap = useMemo(() => buildHeatMap(conflicts), [conflicts])

  const conflictCountries = useMemo(() => {
    const set = new Set<string>()

    conflicts.forEach((conflict) => {
      if (conflict.country) set.add(conflict.country)

      const opponentType = (conflict as any).opponentType
      if (conflict.opponent && (!opponentType || opponentType === 'state')) {
        set.add(conflict.opponent)
      }
    })

    return set
  }, [conflicts])

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
    const viewportArea = size.width * size.height

    return geoData.features
      .map((feature) => {
        const name = getCountryName(feature)
        const point = centroids.get(name)
        if (!point) return null

        const bounds = pathBuilder.bounds(feature as GeoPermissibleObjects)
        const width = Math.max(0, bounds[1][0] - bounds[0][0])
        const height = Math.max(0, bounds[1][1] - bounds[0][1])
        const area = width * height

        let labelSize: LabelSize = 'small'
        if (area > viewportArea * 0.01) labelSize = 'large'
        else if (area > viewportArea * 0.0035) labelSize = 'medium'

        return { name, x: point[0], y: point[1], size: labelSize, area }
      })
      .filter((label): label is CountryLabel => label !== null)
  }, [geoData, centroids, pathBuilder, size.width, size.height])

  const visibleLabels = useMemo(() => {
    const allowed = labels
      .filter((label) => conflictCountries.has(label.name))
      .filter((label) => shouldShowLabel(zoomLevel, label.size))
      .sort((a, b) => b.area - a.area)

    return filterLabelOverlap(allowed, zoomLevel)
  }, [labels, zoomLevel, conflictCountries])

  const activeRoutes = useMemo(() => {
    return conflicts
      .filter((conflict) => conflict.active !== false)
      .map((conflict) => {
        const opponentType = (conflict as any).opponentType
        if (opponentType && opponentType !== 'state') return null

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

    const behavior = zoom<SVGSVGElement, unknown>()
      .scaleExtent([1, 8])
      .filter((event: any) => {
        // Оставляем только zoom колесом.
        // Drag-pan отключаем полностью.
        return event.type === 'wheel'
      })
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
        const isConflict = conflictCountries.has(name)
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
  }, [geoData, conflictCountries, selectedCountry, pathBuilder, heatMap, onHoverText, onSelectCountry])

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

    select(svgRef.current)
      .transition()
      .duration(500)
      .call(zoomRef.current.transform as any, zoomIdentity.translate(tx, ty).scale(scale))
  }, [selectedCountry, geoData, pathBuilder, size.width, size.height])

  useEffect(() => {
    if (!svgRef.current || !zoomRef.current) return
    select(svgRef.current).call(zoomRef.current.transform as any, zoomIdentity)
  }, [resetSignal])

  return (
    <section className="panel map-panel" ref={ref}>
      <button
        type="button"
        className={`retro-toggle ${retroMode ? 'active' : ''}`}
        onClick={() => setRetroMode((v) => !v)}
      >
        {retroMode ? '8-bit ON' : '8-bit'}
      </button>

      <svg
        ref={svgRef}
        className="world-svg"
        width={size.width}
        height={size.height}
        role="img"
        aria-label="World conflict map"
      >
        <rect className="ocean" width={size.width} height={size.height} />

        <g ref={zoomLayerRef}>
          <g ref={countriesLayerRef} />
          <ConflictLines conflicts={conflicts} centroids={centroids} onHoverText={onHoverText} />

          <g>
            {visibleLabels.map((label) => (
              <text key={label.name} x={label.x} y={label.y} className={`country-label ${label.size}`}>
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
