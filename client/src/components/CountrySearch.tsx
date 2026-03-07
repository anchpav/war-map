type CountrySearchProps = {
  countries: string[]
  selectedCountry: string
  onSelectCountry: (country: string) => void
}

/**
 * Simple searchable country input with native datalist autocomplete.
 */
export function CountrySearch({ countries, selectedCountry, onSelectCountry }: CountrySearchProps) {
  return (
    <div className="panel search-panel">
      <label htmlFor="country-search">Country search</label>
      <input
        id="country-search"
        list="country-list"
        value={selectedCountry}
        onChange={(event) => onSelectCountry(event.target.value)}
        placeholder="Type any country"
      />
      <datalist id="country-list">
        {countries.map((country) => (
          <option key={country} value={country} />
        ))}
      </datalist>
    </div>
  )
}
