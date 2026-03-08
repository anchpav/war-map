export type Conflict = {
  country: string
  opponent: string
  start?: string
  active?: boolean
}

export type Metrics = {
  totalConflicts: number
  activeConflicts: number
  countriesAtWar: number
  globalDaysWithoutWar: number
  selectedCountryConflicts: number
  selectedCountryDaysWithoutWar: number
}
