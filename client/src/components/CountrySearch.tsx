type CountrySearchProps = {
  countries: string[]
  selectedCountry: string
  onSelectCountry: (country: string) => void
}

/** Country search with native browser autocomplete. */
export function CountrySearch({ countries, selectedCountry, onSelectCountry }: CountrySearchProps) {
  return (
    <div className="panel search-panel">
      <label htmlFor="country-search">Country search</label>
      <input
        id="country-search"
        list="country-options"
        value={selectedCountry}
        onChange={(event) => onSelectCountry(event.target.value)}
        placeholder="Type country name"
      />
      <datalist id="country-options">
        {countries.map((country) => (
          <option key={country} value={country} />
        ))}
      </datalist>
    </div>
  )
}
