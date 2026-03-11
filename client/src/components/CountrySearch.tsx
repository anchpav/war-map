import { useEffect, useMemo, useState } from 'react'

type CountrySearchProps = {
  countries: string[]
  selectedCountry: string
  onSelectCountry: (country: string) => void
}

/**
 * Search supports direct replacement:
 * users can type over current selection and switch country without pressing clear.
 */
export function CountrySearch({ countries, selectedCountry, onSelectCountry }: CountrySearchProps) {
  const [query, setQuery] = useState(selectedCountry)

  useEffect(() => {
    setQuery(selectedCountry)
  }, [selectedCountry])

  const suggestions = useMemo(() => {
    const text = query.trim().toLowerCase()
    if (!text) return countries.slice(0, 12)
    return countries.filter((country) => country.toLowerCase().includes(text)).slice(0, 12)
  }, [countries, query])

  return (
    <section className="panel search-panel">
      <label htmlFor="country-search">Country focus</label>
      <input
        id="country-search"
        list="country-options"
        value={query}
        placeholder="Type country name..."
        onChange={(event) => {
          const next = event.target.value
          setQuery(next)

          const exact = countries.find((country) => country.toLowerCase() === next.trim().toLowerCase())
          if (exact) onSelectCountry(exact)
          if (!next.trim()) onSelectCountry('')
        }}
        onBlur={() => {
          const exact = countries.find((country) => country.toLowerCase() === query.trim().toLowerCase())
          if (exact) {
            setQuery(exact)
            onSelectCountry(exact)
          }
        }}
      />
      <datalist id="country-options">
        {suggestions.map((country) => (
          <option key={country} value={country} />
        ))}
      </datalist>
    </section>
  )
}
