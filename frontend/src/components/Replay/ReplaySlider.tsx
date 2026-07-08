import React, { useEffect, useMemo } from 'react'
import { Play, Pause, SkipBack, RotateCcw } from 'lucide-react'
import { useGlobeStore } from '../../store/useGlobeStore'

const PRESET_OPTIONS = [
  { label: 'Live', value: null },
  { label: '1 Hour', value: '1h' },
  { label: '24 Hours', value: '24h' },
  { label: '7 Days', value: '7d' },
] as const

const SPEED_OPTIONS = [1, 2, 5, 10]

export const ReplaySlider: React.FC = () => {
  const replay = useGlobeStore((s) => s.replay)
  const setReplay = useGlobeStore((s) => s.setReplay)
  const wsConnected = useGlobeStore((s) => s.wsConnected)
  const events = useGlobeStore((s) => s.events)
  const tickReplay = useGlobeStore((s) => s.tickReplay)

  const togglePlay = () => setReplay({ playing: !replay.playing })
  const setSpeed = (s: number) => setReplay({ speed: s })

  // 1. Handle clicking preset tabs
  const handlePresetSelect = (value: '1h' | '24h' | '7d' | null) => {
    if (value === null) {
      setReplay({
        active: false,
        preset: null,
        startTime: null,
        endTime: null,
        currentTime: null,
        playing: false,
      })
      return
    }

    const end = new Date()
    let durationMs = 60 * 60 * 1000 // 1 hour
    if (value === '24h') durationMs = 24 * 60 * 60 * 1000
    if (value === '7d') durationMs = 7 * 24 * 60 * 60 * 1000

    const start = new Date(end.getTime() - durationMs)

    setReplay({
      active: true,
      preset: value,
      startTime: start,
      endTime: end,
      currentTime: start, // Start at the beginning
      playing: true,      // Play automatically
    })
  }

  // 2. Ticking interval to advance time (Uses stable dependencies, runs cleanly)
  useEffect(() => {
    if (!replay.active || !replay.playing) {
      return
    }

    const interval = setInterval(() => {
      tickReplay()
    }, 100)
    return () => clearInterval(interval)
  }, [replay.active, replay.playing, tickReplay])

  // 3. Calculate slider percentage (0 to 1000)
  const sliderValue = useMemo(() => {
    if (!replay.active || !replay.startTime || !replay.endTime || !replay.currentTime) {
      return 1000
    }
    const total = replay.endTime.getTime() - replay.startTime.getTime()
    const current = replay.currentTime.getTime() - replay.startTime.getTime()
    return Math.min(Math.max(Math.floor((current / total) * 1000), 0), 1000)
  }, [replay.active, replay.startTime, replay.endTime, replay.currentTime])

  // 4. Handle manual slider dragging
  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!replay.active || !replay.startTime || !replay.endTime) return

    const pct = parseFloat(e.target.value)
    const total = replay.endTime.getTime() - replay.startTime.getTime()
    const offset = (pct / 1000) * total
    const newTime = new Date(replay.startTime.getTime() + offset)

    setReplay({
      currentTime: newTime,
      playing: false, // Pause when sliding
    })
  }

  // 5. Reset button
  const handleResetReplay = () => {
    if (replay.startTime) {
      setReplay({ currentTime: replay.startTime, playing: false })
    }
  }

  // Format date for timeline display
  const formattedReplayTime = useMemo(() => {
    if (!replay.active || !replay.currentTime) return ''
    return replay.currentTime.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
  }, [replay.active, replay.currentTime])

  return (
    <div className="timeline-bar" id="replay-controls">
      {/* Live status */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
        <div
          className={`status-dot ${replay.active ? 'offline' : (wsConnected ? 'online' : 'offline')}`}
          style={{
            background: replay.active ? '#ffb74d' : (wsConnected ? '#66bb6a' : '#ef5350'),
            boxShadow: replay.active ? '0 0 6px #ffb74d' : (wsConnected ? '0 0 6px #66bb6a' : 'none')
          }}
          id="ws-status-dot"
        />
        <span style={{ fontSize: '11px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
          {replay.active ? 'Replay Mode' : (wsConnected ? 'Monitoring Live' : 'Connecting…')}
        </span>
      </div>

      <div style={{ width: '1px', height: '20px', background: 'var(--glass-border)', flexShrink: 0 }} />

      {/* Preset tabs */}
      <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
        {PRESET_OPTIONS.map(({ label, value }) => (
          <button
            key={label}
            id={`replay-preset-${label.toLowerCase().replace(' ', '-')}`}
            onClick={() => handlePresetSelect(value)}
            style={{
              padding: '4px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: 500,
              background: replay.preset === value ? 'var(--accent-primary)' : 'var(--glass-bg)',
              color: replay.preset === value ? '#fff' : 'var(--text-secondary)',
              border: `1px solid ${replay.preset === value ? 'transparent' : 'var(--glass-border)'}`,
              transition: 'all 0.15s',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Replay Timestamp Display */}
      {replay.active && (
        <div style={{ fontSize: '11px', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', minWidth: '150px', textAlign: 'center' }}>
          {formattedReplayTime}
        </div>
      )}

      {/* Slider */}
      <input
        id="replay-timeline-slider"
        type="range"
        min={0}
        max={1000}
        value={sliderValue}
        onChange={handleSliderChange}
        style={{
          flex: 1,
          accentColor: 'var(--accent-primary)',
          cursor: replay.active ? 'pointer' : 'not-allowed'
        }}
        disabled={!replay.active}
      />

      {/* Play/Pause controls */}
      {replay.active && (
        <div style={{ display: 'flex', gap: '2px', alignItems: 'center' }}>
          <button
            id="replay-skip-back"
            className="btn btn-ghost"
            style={{ padding: '4px 8px', color: 'var(--text-secondary)' }}
            onClick={handleResetReplay}
            title="Reset to Start"
          >
            <SkipBack size={12} />
          </button>
          <button
            id="replay-play-pause"
            className="btn btn-ghost"
            style={{ padding: '4px 8px', color: 'var(--text-secondary)' }}
            onClick={togglePlay}
            title={replay.playing ? 'Pause Replay' : 'Start Replay'}
          >
            {replay.playing ? <Pause size={12} /> : <Play size={12} />}
          </button>
        </div>
      )}

      {/* Speed Multipliers */}
      {replay.active && (
        <div style={{ display: 'flex', gap: '3px', flexShrink: 0 }}>
          {SPEED_OPTIONS.map((s) => (
            <button
              key={s}
              id={`replay-speed-${s}x`}
              onClick={() => setSpeed(s)}
              style={{
                padding: '3px 7px', borderRadius: '5px', fontSize: '10px', fontFamily: 'var(--font-mono)',
                background: replay.speed === s ? 'rgba(79,158,255,0.2)' : 'transparent',
                color: replay.speed === s ? 'var(--accent-primary)' : 'var(--text-muted)',
                border: `1px solid ${replay.speed === s ? 'rgba(79,158,255,0.4)' : 'transparent'}`,
                cursor: 'pointer',
                transition: 'all 0.15s'
              }}
            >
              {s}×
            </button>
          ))}
        </div>
      )}

      {/* Total event count */}
      <div style={{ marginLeft: 'auto', flexShrink: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
        <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
          {events.length.toLocaleString()} total events
        </span>
      </div>
    </div>
  )
}
