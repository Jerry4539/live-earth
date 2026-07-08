import { Suspense, useState } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'react-hot-toast'
import { Settings } from 'lucide-react'
import { GlobeViewer } from './components/Globe/GlobeViewer'
import { LayerSelector } from './components/Sidebar/LayerSelector'
import { SearchBar } from './components/Sidebar/SearchBar'
import { FilterPanel } from './components/Sidebar/FilterPanel'
import { EventDetail } from './components/Panel/EventDetail'
import { Charts } from './components/Panel/Charts'
import { Timeline } from './components/Panel/Timeline'
import { ReplaySlider } from './components/Replay/ReplaySlider'
import { SettingsModal } from './components/Settings/SettingsModal'
import { NavigationControls } from './components/Globe/NavigationControls'
import { useWebSocket } from './hooks/useWebSocket'
import { useEvents, useStats } from './hooks/useEvents'
import { useGlobeStore } from './store/useGlobeStore'
import './styles/globals.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      refetchOnWindowFocus: false,
    },
  },
})

function AppHeader({ onSettingsClick }: { onSettingsClick: () => void }) {
  const wsConnected = useGlobeStore((s) => s.wsConnected)
  const events = useGlobeStore((s) => s.events)

  return (
    <div
      style={{
        position: 'absolute',
        top: 12,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 20,
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
        padding: '6px 8px 6px 20px',
        borderRadius: '40px',
        background: 'rgba(6,8,16,0.85)',
        backdropFilter: 'blur(20px)',
        border: '1px solid rgba(255,255,255,0.08)',
        boxShadow: '0 4px 24px rgba(0,0,0,0.5)',
        pointerEvents: 'auto',
      }}
      id="app-header"
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', pointerEvents: 'none' }}>
        <div style={{
          width: '24px', height: '24px', borderRadius: '6px',
          background: 'linear-gradient(135deg, #4f9eff, #7b5ea7)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '13px',
        }}>🌍</div>
        <span style={{ fontFamily: 'var(--font-head)', fontWeight: 700, fontSize: '16px', letterSpacing: '-0.3px' }}>
          WorldLive
        </span>
      </div>
      <div style={{ width: '1px', height: '16px', background: 'rgba(255,255,255,0.12)', pointerEvents: 'none' }} />
      <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)', fontFamily: 'var(--font-mono)', pointerEvents: 'none' }}>
        {events.length.toLocaleString()} events
      </span>
      <div style={{ display: 'flex', alignItems: 'center', gap: '5px', pointerEvents: 'none' }}>
        <div style={{
          width: '6px', height: '6px', borderRadius: '50%',
          background: wsConnected ? '#66bb6a' : '#ef5350',
          boxShadow: wsConnected ? '0 0 6px #66bb6a' : 'none',
        }} />
        <span style={{ fontSize: '10px', color: wsConnected ? '#66bb6a' : 'rgba(255,255,255,0.4)' }}>
          {wsConnected ? 'Connected' : 'Connecting…'}
        </span>
      </div>

      {/* Settings gear button */}
      <button
        id="open-settings-btn"
        onClick={onSettingsClick}
        title="Settings"
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          width: '30px', height: '30px', borderRadius: '50%',
          background: 'rgba(255,255,255,0.06)',
          border: '1px solid rgba(255,255,255,0.1)',
          color: 'rgba(255,255,255,0.5)',
          transition: 'all 0.2s',
          cursor: 'pointer',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'rgba(79,158,255,0.15)'
          e.currentTarget.style.color = 'var(--accent-primary)'
          e.currentTarget.style.borderColor = 'rgba(79,158,255,0.3)'
          e.currentTarget.querySelector('svg')!.style.transform = 'rotate(45deg)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'rgba(255,255,255,0.06)'
          e.currentTarget.style.color = 'rgba(255,255,255,0.5)'
          e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'
          e.currentTarget.querySelector('svg')!.style.transform = 'rotate(0deg)'
        }}
      >
        <Settings size={14} style={{ transition: 'transform 0.3s ease' }} />
      </button>
    </div>
  )
}

function DataLoader() {
  useWebSocket()
  useEvents()
  useStats()
  return null
}

export default function App() {
  const [settingsOpen, setSettingsOpen] = useState(false)
  return (
    <QueryClientProvider client={queryClient}>
      <DataLoader />
      <div style={{ width: '100vw', height: '100vh', background: 'var(--bg-void)', overflow: 'hidden', position: 'relative' }}>

        {/* Globe (full screen background) */}
        <div style={{ position: 'absolute', inset: 0 }}>
          <Suspense fallback={
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)' }}>
              <div className="spinner" style={{ marginRight: '12px' }} />
              Loading globe…
            </div>
          }>
            <GlobeViewer />
          </Suspense>
        </div>

        {/* Floating Navigation & Compass Controls */}
        <NavigationControls />

        {/* Header */}
        <AppHeader onSettingsClick={() => setSettingsOpen(true)} />

        {/* Left Sidebar */}
        <div className="sidebar">
          <SearchBar />
          <LayerSelector />
          <FilterPanel />
        </div>

        {/* Right Panel */}
        <div className="right-panel">
          <EventDetail />
          <Charts />
          <Timeline />
        </div>

        {/* Bottom replay bar */}
        <ReplaySlider />

        {/* Settings Modal */}
        <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />

        {/* Toast notifications */}
        <Toaster
          position="bottom-center"
          toastOptions={{
            style: {
              background: 'rgba(15,21,38,0.95)',
              border: '1px solid rgba(255,255,255,0.08)',
              color: '#fff',
              fontSize: '13px',
              fontFamily: 'Inter, sans-serif',
              backdropFilter: 'blur(20px)',
              marginBottom: '60px',
            },
          }}
        />
      </div>
    </QueryClientProvider>
  )
}
