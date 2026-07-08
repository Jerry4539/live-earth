import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { format } from 'date-fns'
import { useGlobeStore } from '../../store/useGlobeStore'
import type { WorldEvent } from '../../store/useGlobeStore'

const LAYER_COLORS: Record<string, string> = {
  earthquake: '#ff6b35',
  weather:    '#4fc3f7',
  satellite:  '#ce93d8',
  volcano:    '#ff5252',
  wildfire:   '#ffb74d',
  airquality: '#66bb6a',
}

const LAYER_ICONS: Record<string, string> = {
  earthquake: '🌍',
  weather:    '🌤️',
  satellite:  '🛰️',
  volcano:    '🌋',
  wildfire:   '🔥',
  airquality: '💨',
}

interface EventRowProps {
  event: WorldEvent
  selected: boolean
  onClick: () => void
  index: number
}

const EventRow: React.FC<EventRowProps> = ({ event, selected, onClick, index }) => {
  const color = LAYER_COLORS[event.type] || '#fff'
  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.02, duration: 0.2 }}
      className={`event-item ${selected ? 'selected' : ''}`}
      onClick={onClick}
      id={`event-item-${event.id}`}
    >
      <div style={{ position: 'relative', flexShrink: 0, marginTop: '2px' }}>
        <span style={{ fontSize: '16px' }}>{LAYER_ICONS[event.type]}</span>
        {event.severity >= 4 && (
          <span style={{
            position: 'absolute', top: '-2px', right: '-4px',
            width: '8px', height: '8px', borderRadius: '50%',
            background: `var(--sev-${event.severity})`,
            boxShadow: `0 0 6px var(--sev-${event.severity})`,
          }} />
        )}
      </div>
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <div style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-primary)', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
          {event.title}
        </div>
        <div style={{ display: 'flex', gap: '8px', marginTop: '2px', alignItems: 'center' }}>
          <span style={{ fontSize: '10px', color, fontFamily: 'var(--font-mono)', textTransform: 'uppercase' }}>
            {event.type}
          </span>
          <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
            {(() => {
              try {
                let tStr = String(event.timestamp)
                if (!tStr.endsWith('Z') && !tStr.includes('+') && !tStr.includes('-')) {
                  tStr += 'Z'
                }
                return format(new Date(tStr), 'HH:mm')
              } catch {
                return String(event.timestamp).split('T')[1]?.substring(0, 5) || ''
              }
            })()}
          </span>
        </div>
      </div>
      <div style={{
        flexShrink: 0,
        width: '4px', alignSelf: 'stretch', borderRadius: '2px',
        background: `var(--sev-${event.severity})`,
        opacity: 0.8,
      }} />
    </motion.div>
  )
}

export const Timeline: React.FC = () => {
  const events = useGlobeStore((s) => s.events)
  const selectedEvent = useGlobeStore((s) => s.selectedEvent)
  const setSelectedEvent = useGlobeStore((s) => s.setSelectedEvent)
  const layers = useGlobeStore((s) => s.layers)
  const severityFilter = useGlobeStore((s) => s.severityFilter)
  const replay = useGlobeStore((s) => s.replay)

  const enabledTypes = new Set(layers.filter((l) => l.enabled).map((l) => l.name))

  const isReplayActive = replay.active && replay.currentTime !== null && replay.startTime !== null
  const replayTimeMs = replay.currentTime ? new Date(replay.currentTime).getTime() : 0
  const startTimeMs = replay.startTime ? new Date(replay.startTime).getTime() : 0

  const visible = events
    .filter((e) => {
      if (!enabledTypes.has(e.type)) return false
      if (e.severity < severityFilter) return false
      if (isReplayActive) {
        const eventMs = new Date(e.timestamp).getTime()
        return eventMs >= startTimeMs && eventMs <= replayTimeMs
      }
      return true
    })
    .slice(0, 50)

  return (
    <div className="card fade-in" style={{ padding: '14px', flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }} id="timeline-panel">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
        <h3>Live Feed</h3>
        <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
          {visible.length} events
        </span>
      </div>
      <div style={{ overflowY: 'auto', flex: 1 }}>
        <AnimatePresence initial={false}>
          {visible.map((event, i) => (
            <EventRow
              key={event.id}
              event={event}
              selected={selectedEvent?.id === event.id}
              onClick={() => setSelectedEvent(event)}
              index={i}
            />
          ))}
        </AnimatePresence>
        {visible.length === 0 && (
          <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)', fontSize: '12px' }}>
            No events match current filters.<br />
            Data loads on startup.
          </div>
        )}
      </div>
    </div>
  )
}
