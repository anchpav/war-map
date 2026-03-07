export type Conflict = {
  id: string
  name: string
  countries: [string, string] | string[]
  start_date: string
  end_date?: string | null
  active: boolean
  description: string
}

export type ConflictsResponse = {
  conflicts: Conflict[]
}

export type Metrics = {
  totalConflicts: number
  activeConflicts: number
  daysWithoutWarWorld: number
  daysWithoutWarSelected: number
}
