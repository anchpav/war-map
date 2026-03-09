import type { CountryFeatureCollection } from '../types'

/** Load world GeoJSON from Vite public folder. */
export async function loadWorldGeoData(): Promise<CountryFeatureCollection> {
  const response = await fetch('/data/world.geo.json')
  if (!response.ok) {
    throw new Error('Cannot load /data/world.geo.json')
  }
  return response.json()
}

/** Read a consistent country name from GeoJSON properties. */
export function getCountryName(feature: any): string {
  return String(feature?.properties?.ADMIN ?? feature?.properties?.name ?? 'Unknown')
}
