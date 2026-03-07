/** Load local GeoJSON used by D3 world map renderer. */
export async function fetchWorldGeoJSON() {
  const response = await fetch('/data/world.geo.json')
  if (!response.ok) {
    throw new Error('Cannot load world.geo.json from client/public/data.')
  }
  return response.json()
}
