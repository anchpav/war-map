import type { Conflict } from '../types'

/** Load conflicts from backend API. */
export async function getConflicts(): Promise<Conflict[]> {
  const response = await fetch('/api/conflicts')
  if (!response.ok) throw new Error('Cannot load conflicts. Start backend with: node server/index.js')

  const data = await response.json()
  return Array.isArray(data) ? data : []
}

/** Load world GeoJSON from local static data folder. */
export async function getWorldGeoJSON() {
  const response = await fetch('/data/world.geo.json')
  if (!response.ok) throw new Error('Cannot load world.geo.json')
  return response.json()
}
