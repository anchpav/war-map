import type { Conflict } from '../types'

/**
 * Load conflict pairs from backend first.
 * Fallback to static JSON so the UI still works if backend is down.
 */
export async function loadConflicts(): Promise<Conflict[]> {
  try {
    const apiResponse = await fetch('/api/conflicts')
    if (apiResponse.ok) {
      const apiData = await apiResponse.json()
      return Array.isArray(apiData) ? apiData : []
    }
  } catch {
    // Ignore API errors and use local static data below.
  }

  const staticResponse = await fetch('/data/conflicts.json')
  if (!staticResponse.ok) {
    throw new Error('Cannot load conflicts data. Start backend or check /data/conflicts.json.')
  }

  const staticData = await staticResponse.json()
  return Array.isArray(staticData) ? staticData : []
}
