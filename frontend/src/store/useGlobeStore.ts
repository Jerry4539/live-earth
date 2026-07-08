import { create } from 'zustand'
import { devtools } from 'zustand/middleware'

export type EventType = 'earthquake' | 'weather' | 'satellite' | 'volcano' | 'wildfire' | 'airquality'

export interface WorldEvent {
  id: string
  external_id: string
  type: EventType
  latitude: number
  longitude: number
  timestamp: string
  severity: number
  title: string
  description: string
  payload: Record<string, unknown>
  source_url: string
}

export interface LayerState {
  name: EventType
  display_name: string
  enabled: boolean
  color: string
  icon: string
}

export interface ReplayState {
  active: boolean
  preset: '1h' | '24h' | '7d' | null
  startTime: Date | null
  endTime: Date | null
  currentTime: Date | null
  playing: boolean
  speed: number // 1, 2, 5, 10
}

interface GlobeStore {
  // Connection
  wsConnected: boolean
  setWsConnected: (v: boolean) => void

  // Layers
  layers: LayerState[]
  setLayers: (layers: LayerState[]) => void
  toggleLayer: (name: EventType) => void

  // Events
  events: WorldEvent[]
  addEvent: (e: WorldEvent) => void
  addEvents: (events: WorldEvent[]) => void
  clearEvents: () => void

  // Selection
  selectedEvent: WorldEvent | null
  setSelectedEvent: (e: WorldEvent | null) => void

  // Filters
  severityFilter: number
  setSeverityFilter: (s: number) => void
  searchQuery: string
  setSearchQuery: (q: string) => void

  // Replay
  replay: ReplayState
  setReplay: (r: Partial<ReplayState>) => void

  // Stats
  stats: Record<string, number>
  setStats: (s: Record<string, number>) => void

  // Camera Fly-to
  flyToCoords: { latitude: number; longitude: number } | null
  setFlyToCoords: (coords: { latitude: number; longitude: number } | null) => void

  // Cesium Viewer Ref
  viewer: any | null
  setViewer: (v: any | null) => void

  // Replay ticks
  tickReplay: () => void
}

export const useGlobeStore = create<GlobeStore>()(
  devtools(
    (set) => ({
      // Connection
      wsConnected: false,
      setWsConnected: (v) => set({ wsConnected: v }),

      // Layers
      layers: [
        { name: 'earthquake', display_name: 'Earthquakes',  enabled: true, color: '#ff6b35', icon: '🌍' },
        { name: 'weather',    display_name: 'Weather',       enabled: true, color: '#4fc3f7', icon: '🌤️' },
        { name: 'satellite',  display_name: 'Satellites',    enabled: true, color: '#ce93d8', icon: '🛰️' },
        { name: 'volcano',    display_name: 'Volcanoes',     enabled: true, color: '#ff5252', icon: '🌋' },
        { name: 'wildfire',   display_name: 'Wildfires',     enabled: true, color: '#ffb74d', icon: '🔥' },
        { name: 'airquality', display_name: 'Air Quality',   enabled: true, color: '#66bb6a', icon: '💨' },
      ],
      setLayers: (layers) => set({ layers }),
      toggleLayer: (name) =>
        set((s) => ({
          layers: s.layers.map((l) =>
            l.name === name ? { ...l, enabled: !l.enabled } : l
          ),
        })),

      // Events (capped at 3000 most recent, strictly deduplicated by ID)
      events: [],
      addEvent: (e) =>
        set((s) => {
          if (s.events.some((x) => x.id === e.id)) return s
          return { events: [e, ...s.events].slice(0, 3000) }
        }),
      addEvents: (newEvents) =>
        set((s) => {
          const seen = new Set<string>()
          const unique = [...newEvents, ...s.events].filter((e) => {
            if (seen.has(e.id)) return false
            seen.add(e.id)
            return true
          })
          return { events: unique.slice(0, 3000) }
        }),
      clearEvents: () => set({ events: [] }),

      // Selection
      selectedEvent: null,
      setSelectedEvent: (e) => set({ selectedEvent: e }),

      // Filters
      severityFilter: 0,
      setSeverityFilter: (s) => set({ severityFilter: s }),
      searchQuery: '',
      setSearchQuery: (q) => set({ searchQuery: q }),

      // Replay
      replay: {
        active: false,
        preset: null,
        startTime: null,
        endTime: null,
        currentTime: null,
        playing: false,
        speed: 1,
      },
      setReplay: (r) =>
        set((s) => ({ replay: { ...s.replay, ...r } })),

      // Stats
      stats: {},
      setStats: (stats) => set({ stats }),

      // Camera Fly-to
      flyToCoords: null,
      setFlyToCoords: (coords) => set({ flyToCoords: coords }),

      // Cesium Viewer Ref
      viewer: null,
      setViewer: (v) => set({ viewer: v }),

      // Centralized Replay Clock Ticking
      tickReplay: () =>
        set((s) => {
          const { active, playing, startTime, endTime, currentTime, preset, speed } = s.replay
          if (!active || !playing || !startTime || !endTime || !currentTime) {
            return {}
          }

          let baseStepMs = 12000 // 12s per tick for 1h
          if (preset === '24h') baseStepMs = 192000 // 192s for 24h
          if (preset === '7d') baseStepMs = 1008000 // 1008s for 7d

          const stepSize = baseStepMs * speed
          const currentMs = currentTime.getTime()
          const endMs = endTime.getTime()
          const startMs = startTime.getTime()

          if (currentMs + stepSize >= endMs) {
            // Loop back to start
            return { replay: { ...s.replay, currentTime: new Date(startMs) } }
          } else {
            return { replay: { ...s.replay, currentTime: new Date(currentMs + stepSize) } }
          }
        }),
    }),
    { name: 'WorldLiveStore' }
  )
)
