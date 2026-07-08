import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, ExternalLink, MapPin, Clock } from 'lucide-react'
import { format } from 'date-fns'
import { useGlobeStore } from '../../store/useGlobeStore'

const LAYER_COLORS: Record<string, string> = {
  earthquake: '#ff6b35',
  weather:    '#4fc3f7',
  satellite:  '#ce93d8',
  volcano:    '#ff5252',
  wildfire:   '#ffb74d',
  airquality: '#66bb6a',
}

const SEVERITY_LABELS = ['Unknown', 'Minor', 'Low', 'Moderate', 'High', 'Extreme']

function PayloadRow({ label, value }: { label: string; value: unknown }) {
  if (value === null || value === undefined || value === '') return null
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid var(--glass-border)' }}>
      <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</span>
      <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', maxWidth: '60%', textAlign: 'right', wordBreak: 'break-all' }}>
        {String(value)}
      </span>
    </div>
  )
}

export const EventDetail: React.FC = () => {
  const selectedEvent = useGlobeStore((s) => s.selectedEvent)
  const setSelectedEvent = useGlobeStore((s) => s.setSelectedEvent)

  if (!selectedEvent) return null

  // Safely parse SQLite payloads which might return as raw strings
  let payloadObj: Record<string, unknown> = {}
  if (selectedEvent.payload) {
    if (typeof selectedEvent.payload === 'string') {
      try {
        payloadObj = JSON.parse(selectedEvent.payload)
      } catch {
        payloadObj = {}
      }
    } else if (typeof selectedEvent.payload === 'object') {
      payloadObj = selectedEvent.payload as Record<string, unknown>
    }
  }

  // Safely parse coordinates
  const lat = Number(selectedEvent.latitude)
  const lon = Number(selectedEvent.longitude)
  const latStr = isNaN(lat) ? '0.00' : lat.toFixed(2)
  const lonStr = isNaN(lon) ? '0.00' : lon.toFixed(2)

  // Safely format timestamp
  let formattedDate = ''
  try {
    if (selectedEvent.timestamp) {
      let tStr = String(selectedEvent.timestamp)
      // Append Z to treat as UTC if no timezone specifier is present (helps cross-browser parsing)
      if (!tStr.endsWith('Z') && !tStr.includes('+') && !tStr.includes('-')) {
        tStr += 'Z'
      }
      formattedDate = format(new Date(tStr), 'MMM d, yyyy, h:mm:ss a')
    }
  } catch {
    formattedDate = String(selectedEvent.timestamp)
  }

  return (
    <AnimatePresence>
      {selectedEvent && (
        <motion.div
          key={selectedEvent.id}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          className="card fade-in"
          style={{ padding: '16px', flexShrink: 0 }}
          id="event-detail-panel"
        >
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
            <div style={{ flex: 1 }}>
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: '6px',
                padding: '2px 8px', borderRadius: '20px', marginBottom: '6px',
                background: `${LAYER_COLORS[selectedEvent.type] || '#fff'}20`,
                border: `1px solid ${LAYER_COLORS[selectedEvent.type] || '#fff'}40`,
              }}>
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: LAYER_COLORS[selectedEvent.type] }} />
                <span style={{ fontSize: '10px', fontWeight: 600, color: LAYER_COLORS[selectedEvent.type], textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  {selectedEvent.type}
                </span>
              </div>
              <h2 style={{ fontSize: '14px', fontWeight: 600, lineHeight: 1.3, color: 'var(--text-primary)' }}>
                {selectedEvent.title}
              </h2>
            </div>
            <button
              id="close-event-detail"
              onClick={() => setSelectedEvent(null)}
              style={{ padding: '4px', color: 'var(--text-muted)', borderRadius: '6px', flexShrink: 0, marginLeft: '8px' }}
            >
              <X size={14} />
            </button>
          </div>

          {/* Metadata */}
          <div style={{ display: 'flex', gap: '12px', marginBottom: '12px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--text-muted)', fontSize: '11px' }}>
              <MapPin size={10} />
              <span style={{ fontFamily: 'var(--font-mono)' }}>
                {latStr}°, {lonStr}°
              </span>
            </div>
            {formattedDate && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--text-muted)', fontSize: '11px' }}>
                <Clock size={10} />
                <span>{formattedDate}</span>
              </div>
            )}
          </div>

          {/* Severity */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '8px 10px', borderRadius: '8px', marginBottom: '12px',
            background: 'var(--glass-bg)', border: '1px solid var(--glass-border)',
          }}>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Severity</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ display: 'flex', gap: '3px' }}>
                {[1,2,3,4,5].map((i) => (
                  <div key={i} style={{
                    width: '8px', height: '8px', borderRadius: '2px',
                    background: i <= selectedEvent.severity
                      ? `var(--sev-${Math.min(selectedEvent.severity, 5)})`
                      : 'rgba(255,255,255,0.1)',
                  }} />
                ))}
              </div>
              <span style={{ fontSize: '12px', fontWeight: 600, color: `var(--sev-${selectedEvent.severity})` }}>
                {SEVERITY_LABELS[selectedEvent.severity] || 'Unknown'}
              </span>
            </div>
          </div>

          {/* Description */}
          {selectedEvent.description && (
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '12px', lineHeight: 1.6 }}>
              {selectedEvent.description}
            </p>
          )}

          {/* Payload */}
          <div style={{ marginBottom: '12px' }}>
            {Object.entries(payloadObj).slice(0, 8).map(([k, v]) => (
              <PayloadRow key={k} label={k.replace(/_/g, ' ')} value={v} />
            ))}
          </div>

          {/* Source link */}
          {selectedEvent.source_url && (
            <a
              href={selectedEvent.source_url}
              target="_blank"
              rel="noopener noreferrer"
              id="event-source-link"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '6px',
                fontSize: '12px', color: 'var(--accent-primary)', textDecoration: 'none',
              }}
            >
              <ExternalLink size={12} />
              View Source
            </a>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
