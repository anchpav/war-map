import { select } from 'd3-selection'
import { geoMercator, geoPath, geoCentroid } from 'd3-geo'
import { zoom, zoomIdentity, type ZoomBehavior } from 'd3-zoom'
import { useEffect, useMemo, useRef } from 'react'
import type { Conflict } from '../types'
import { ConflictLines } from './ConflictLines'

type WorldMapProps = {
  geoData: any
  conflicts: Conflict[]
  selectedCountry: string
  onSelectCountry: (country: string) => void
  onTooltipChange: (text: string) => void
}

const WIDTH = 1000
const HEIGHT = 520

export function WorldMap({ geoData, conflicts, selectedCountry, onSelectCountry, onTooltipChange }: WorldMapProps) {
  const svgRef = useRef<SVGSVGElement | null>(null)
  const mapGroupRef = useRef<SVGGElement | null>(null)
  const zoomRef = useRef<ZoomBehavior<SVGSVGElement, unknown> | null>(null)

  const projection = useMemo(
    () => geoMercator().fitSize([WIDTH, HEIGHT], geoData).precision(0.1),
    [geoData]
  )

  const pathGenerator = useMemo(() => geoPath(projection), [projection])

  useEffect(() => {
    if (!svgRef.current || !mapGroupRef.current) return

    const svg = select(svgRef.current)
    const mapGroup = select(mapGroupRef.current)

    const zoomBehavior = zoom<SVGSVGElement, unknown>()
      .scaleExtent([1, 8])
      .on('zoom', (event) => {
        mapGroup.attr('transform', event.transform)
      })

    zoomRef.current = zoomBehavior
    svg.call(zoomBehavior)
  }, [])

  useEffect(() => {
    if (!selectedCountry || !svgRef.current || !zoomRef.current) return

    // Focus the selected country to improve usability after search selection.
    const feature = geoData.features.find((item: any) => item.properties?.name === selectedCountry)
    if (!feature) return

    const [lon, lat] = geoCentroid(feature)
    const point = projection([lon, lat])
    if (!point) return

    const target = zoomIdentity.translate(WIDTH / 2 - point[0] * 2, HEIGHT / 2 - point[1] * 2).scale(2)

    select(svgRef.current).transition().duration(500).call(zoomRef.current.transform as any, target)
  }, [selectedCountry, geoData, projection])

  return (
    <div className="panel map-panel">
      <svg ref={svgRef} viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="world-svg">
        <g ref={mapGroupRef}>
          {geoData.features.map((feature: any) => {
            const countryName = feature.properties?.name ?? 'Unknown'
            const isSelected = countryName === selectedCountry

            return (
              <path
                key={countryName}
                d={pathGenerator(feature) ?? undefined}
                className={`country ${isSelected ? 'selected' : ''}`}
                onMouseEnter={() => onTooltipChange(countryName)}
                onMouseLeave={() => onTooltipChange('')}
                onClick={() => onSelectCountry(countryName)}
              />
            )
          })}

          <ConflictLines
            conflicts={conflicts}
            projection={projection}
            features={geoData.features}
            onHoverConflict={onTooltipChange}
            onLeaveConflict={() => onTooltipChange('')}
          />
        </g>
      </svg>
    </div>
  )
}
