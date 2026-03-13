export type OpponentType = 'state' | 'non-state' | 'proxy'

export type Conflict = {
  country: string
  opponent: string
  opponentType?: OpponentType
  start?: string
  end?: string | null
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

export type CountryFeature = {
  type: 'Feature'
  properties?: {
    ADMIN?: string
    name?: string
    [key: string]: unknown
  }
  geometry: unknown
}

export type CountryFeatureCollection = {
  type: 'FeatureCollection'
  features: CountryFeature[]
}
