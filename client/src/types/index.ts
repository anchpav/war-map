export type Conflict = {
  id: string
  country: string
  opponent: string
  lat: number
  lon: number
  opponentLat: number
  opponentLon: number
  start: string
  end: string | null
  description: string
}

export type Metrics = {
  totalConflicts: number
  activeConflicts: number
  daysWithoutWarWorld: number
  daysWithoutWarSelected: number
}
