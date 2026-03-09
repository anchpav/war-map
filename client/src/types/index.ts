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
