import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useGlobeStore } from '../../store/useGlobeStore'
import type { EventType } from '../../store/useGlobeStore'

const apiClient = { patch: async (url: string, body: object) => fetch(url, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }) }

const ICONS: Record<EventType, string> = {
  earthquake: '🌍',
  weather:    '🌤️',
  satellite:  '🛰️',
  volcano:    '🌋',
  wildfire:   '🔥',
  airquality: '💨',
}

export const LayerSelector: React.FC = () => {
  const layers = useGlobeStore((s) => s.layers)
  const toggleLayer = useGlobeStore((s) => s.toggleLayer)
  const stats = useGlobeStore((s) => s.stats)

  const handleToggle = async (name: EventType) => {
    toggleLayer(name)
    try {
      await apiClient.patch(`/api/layers/${name}`, { enabled: !layers.find(l => l.name === name)?.enabled })
    } catch { /* non-critical */ }
  }

  return (
    <div className="card fade-in" style={{ padding: '14px' }} id="layer-selector-panel">
      <h3 style={{ marginBottom: '12px' }}>Data Layers</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <AnimatePresence>
          {layers.map((layer) => (
            <motion.div
              key={layer.name}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '8px 10px',
                borderRadius: '8px',
                background: layer.enabled ? `${layer.color}12` : 'transparent',
                border: `1px solid ${layer.enabled ? layer.color + '30' : 'transparent'}`,
                transition: 'all 0.2s ease',
              }}
              id={`layer-toggle-${layer.name}`}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '16px' }}>{ICONS[layer.name]}</span>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 500, color: layer.enabled ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                    {layer.display_name}
                  </div>
                  {stats[layer.name] !== undefined && (
                    <div style={{ fontSize: '11px', color: layer.color, fontFamily: 'var(--font-mono)' }}>
                      {stats[layer.name].toLocaleString()} events
                    </div>
                  )}
                </div>
              </div>
              <label className="toggle" htmlFor={`toggle-${layer.name}`}>
                <input
                  id={`toggle-${layer.name}`}
                  type="checkbox"
                  checked={layer.enabled}
                  onChange={() => handleToggle(layer.name)}
                />
                <span className="toggle-slider" style={{ background: layer.enabled ? layer.color : undefined }} />
              </label>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  )
}
