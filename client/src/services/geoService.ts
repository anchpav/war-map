export async function fetchWorldGeoJSON() {
  const response = await fetch('/data/world.geo.json')
  if (!response.ok) throw new Error('Failed to load world GeoJSON')
  return response.json()
}
