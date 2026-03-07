import type { ConflictsResponse, Metrics } from '../types'

export async function fetchConflicts(): Promise<ConflictsResponse> {
  const response = await fetch('/api/conflicts')
  if (!response.ok) throw new Error('Failed to load conflicts')
  return response.json()
}

export async function fetchMetrics(country?: string): Promise<Metrics> {
  const query = country ? `?country=${encodeURIComponent(country)}` : ''
  const response = await fetch(`/api/metrics${query}`)
  if (!response.ok) throw new Error('Failed to load metrics')
  return response.json()
}

export async function updateConflictsFromAI(): Promise<{ status: string; message: string }> {
  const response = await fetch('/api/update-conflicts', { method: 'POST' })
  if (!response.ok) throw new Error('Failed to run AI update')
  return response.json()
}
