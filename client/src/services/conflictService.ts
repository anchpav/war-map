import type { Conflict } from '../types'

/** Load conflicts from backend API with clear error messages for UI. */
export async function fetchConflicts(): Promise<Conflict[]> {
  const response = await fetch('/api/conflicts')
  if (!response.ok) {
    throw new Error('Server is not available. Please start backend on port 3001.')
  }

  const data = await response.json()
  if (!Array.isArray(data)) {
    throw new Error('Invalid conflicts format from server.')
  }

  return data
}
