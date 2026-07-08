import React, { useState, useCallback } from 'react'
import { Search, X } from 'lucide-react'
import { useGlobeStore } from '../../store/useGlobeStore'

interface NominatimResult {
  lat: string
  lon: string
  display_name: string
}

export const SearchBar: React.FC = () => {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<NominatimResult[]>([])
  const [loading, setLoading] = useState(false)
  const setSearchQuery = useGlobeStore((s) => s.setSearchQuery)
  const setFlyToCoords = useGlobeStore((s) => s.setFlyToCoords)

  const search = useCallback(async (q: string) => {
    if (!q.trim()) { setResults([]); return }
    setLoading(true)
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=5`,
        { headers: { 'Accept-Language': 'en', 'User-Agent': 'WorldLive/1.0' } }
      )
      const data: NominatimResult[] = await res.json()
      setResults(data)
    } catch { /* ignore */ }
    setLoading(false)
  }, [])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') search(query)
  }

  const clear = () => { setQuery(''); setResults([]); setSearchQuery('') }

  return (
    <div className="card" style={{ padding: '10px' }} id="search-panel">
      <div style={{ position: 'relative' }}>
        <Search
          size={14}
          style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }}
        />
        <input
          id="globe-search-input"
          className="search-input"
          type="text"
          placeholder="Search locations…"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setSearchQuery(e.target.value) }}
          onKeyDown={handleKeyDown}
        />
        {query && (
          <button onClick={clear} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}>
            <X size={14} />
          </button>
        )}
      </div>
      {loading && <div style={{ padding: '8px', color: 'var(--text-muted)', fontSize: '12px' }}>Searching…</div>}
      {results.length > 0 && (
        <div style={{ marginTop: '6px', borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--glass-border)' }}>
          {results.map((r, i) => (
            <button
              key={i}
              id={`search-result-${i}`}
              style={{
                display: 'block', width: '100%', textAlign: 'left',
                padding: '8px 10px', fontSize: '12px', color: 'var(--text-secondary)',
                borderBottom: i < results.length - 1 ? '1px solid var(--glass-border)' : 'none',
                transition: 'background 0.15s',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--glass-hover)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              onClick={() => {
                setResults([])
                setQuery(r.display_name.split(',')[0])
                setFlyToCoords({ latitude: parseFloat(r.lat), longitude: parseFloat(r.lon) })
              }}
            >
              {r.display_name}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
