export type Conflict = {
  country: string
  opponent: string
  start?: string
  active: boolean
}

export type Metrics = {
  activeConflicts: number
  countriesAtWar: number
  globalDaysWithoutWar: number
  selectedCountryConflicts: number
  totalConflicts: number
}
