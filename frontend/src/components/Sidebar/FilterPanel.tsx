import React from 'react'
import { useGlobeStore } from '../../store/useGlobeStore'

const SEVERITY_LABELS = ['All', 'Minor', 'Low', 'Moderate', 'High', 'Extreme']
const SEVERITY_COLORS = ['var(--sev-0)', 'var(--sev-1)', 'var(--sev-2)', 'var(--sev-3)', 'var(--sev-4)', 'var(--sev-5)']

export const FilterPanel: React.FC = () => {
  const severityFilter = useGlobeStore((s) => s.severityFilter)
  const setSeverityFilter = useGlobeStore((s) => s.setSeverityFilter)

  return (
    <div className="card fade-in" style={{ padding: '14px' }} id="filter-panel">
      <h3 style={{ marginBottom: '12px' }}>Filters</h3>

      {/* Severity filter */}
      <div style={{ marginBottom: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Min Severity</span>
          <span style={{
            fontSize: '12px', fontWeight: 600, fontFamily: 'var(--font-mono)',
            color: SEVERITY_COLORS[severityFilter],
            padding: '2px 8px', borderRadius: '12px',
            background: `${SEVERITY_COLORS[severityFilter]}20`,
          }}>
            {SEVERITY_LABELS[severityFilter]}
          </span>
        </div>
        <input
          id="severity-filter-slider"
          type="range"
          min={0}
          max={5}
          value={severityFilter}
          onChange={(e) => setSeverityFilter(Number(e.target.value))}
          style={{ width: '100%', accentColor: SEVERITY_COLORS[severityFilter] }}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}>
          {SEVERITY_LABELS.map((_label, i) => (
            <span key={i} style={{ fontSize: '9px', color: i === severityFilter ? SEVERITY_COLORS[i] : 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
              {i}
            </span>
          ))}
        </div>
      </div>

      {/* Severity legend */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        {SEVERITY_LABELS.map((label, i) => (
          <button
            key={i}
            id={`severity-btn-${i}`}
            onClick={() => setSeverityFilter(i)}
            style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              padding: '5px 8px', borderRadius: '6px',
              background: severityFilter === i ? `${SEVERITY_COLORS[i]}15` : 'transparent',
              border: `1px solid ${severityFilter === i ? SEVERITY_COLORS[i] + '40' : 'transparent'}`,
              transition: 'all 0.15s',
              cursor: 'pointer', textAlign: 'left',
            }}
          >
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: SEVERITY_COLORS[i], flexShrink: 0 }} />
            <span style={{ fontSize: '12px', color: severityFilter === i ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
              {label}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}
