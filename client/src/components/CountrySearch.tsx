type CountrySearchProps = {
  countries: string[]
  selectedCountry: string
  onSelectCountry: (country: string) => void
}

export function CountrySearch({ countries, selectedCountry, onSelectCountry }: CountrySearchProps) {
  return (
    <div className="panel search-panel">
      <label htmlFor="country-search">Country</label>
      <input
        id="country-search"
        list="countries"
        value={selectedCountry}
        onChange={(event) => onSelectCountry(event.target.value)}
        placeholder="Search country"
      />
      <datalist id="countries">
        {countries.map((country) => (
          <option key={country} value={country} />
        ))}
      </datalist>
    </div>
  )
}
