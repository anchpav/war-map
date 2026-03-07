import type { ConflictsResponse, Metrics } from '../types'

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, options)

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`API error: ${response.status} ${text}`)
  }

  return response.json()
}

export function fetchConflicts(): Promise<ConflictsResponse> {
  return request('/api/conflicts')
}

export function fetchMetrics(country?: string): Promise<Metrics> {
  const query = country ? `?country=${encodeURIComponent(country)}` : ''
  return request(`/api/metrics${query}`)
}

export function updateConflictsFromAI(): Promise<{ status: string; message: string }> {
  return request('/api/update-conflicts', { method: 'POST' })
}
