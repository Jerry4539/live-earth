import React from 'react'
import {
  Compass, Home, ArrowUp, ArrowDown, ArrowLeft, ArrowRight,
  ZoomIn, ZoomOut, Layers, Eye
} from 'lucide-react'
import { useGlobeStore } from '../../store/useGlobeStore'

export const NavigationControls: React.FC = () => {
  const viewer = useGlobeStore((s) => s.viewer)

  if (!viewer) return null

  // Reset to full global outer space view
  const goHome = () => {
    try {
      const Cesium = (window as any).Cesium
      if (Cesium) {
        viewer.camera.flyTo({
          destination: Cesium.Cartesian3.fromDegrees(0, 20, 18000000.0),
          orientation: {
            heading: 0.0,
            pitch: -Math.PI / 2,
            roll: 0.0,
          },
          duration: 2.0,
        })
      }
    } catch (err) {
      console.warn('Navigation controls: goHome failed', err)
    }
  }

  // Tilt presets
  const setTiltPreset = (preset: 'top' | '3d' | 'horizon') => {
    try {
      let targetPitch = -Math.PI / 2
      if (preset === '3d') targetPitch = -0.90      // Tilted 3D look
      if (preset === 'horizon') targetPitch = -0.32 // Low angle horizon look

      viewer.camera.flyTo({
        destination: viewer.camera.position,
        orientation: {
          heading: viewer.camera.heading,
          pitch: targetPitch,
          roll: viewer.camera.roll,
        },
        duration: 1.0,
      })
    } catch (err) {
      console.warn(err)
    }
  }

  // Adjust camera heading & pitch manually
  const adjustCamera = (action: 'up' | 'down' | 'left' | 'right') => {
    try {
      let headingVal = viewer.camera.heading
      let pitchVal = viewer.camera.pitch

      if (action === 'left') headingVal -= 0.25
      if (action === 'right') headingVal += 0.25
      if (action === 'up') pitchVal = Math.min(pitchVal + 0.12, -0.15)
      if (action === 'down') pitchVal = Math.max(pitchVal - 0.12, -Math.PI / 2)

      viewer.camera.flyTo({
        destination: viewer.camera.position,
        orientation: {
          heading: headingVal,
          pitch: pitchVal,
          roll: viewer.camera.roll,
        },
        duration: 0.3,
      })
    } catch (err) {
      console.warn(err)
    }
  }

  // Zoom manually
  const zoomCamera = (direction: 'in' | 'out') => {
    try {
      const height = viewer.camera.positionCartographic.height
      const amount = height * 0.35 // Dynamic zoom factor based on altitude
      if (direction === 'in') {
        viewer.camera.zoomIn(amount)
      } else {
        viewer.camera.zoomOut(amount)
      }
    } catch (err) {
      console.warn(err)
    }
  }

  const btnStyle: React.CSSProperties = {
    height: '28px',
    padding: '0 8px',
    borderRadius: '6px',
    background: 'rgba(255, 255, 255, 0.05)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '5px',
    fontSize: '11px',
    fontWeight: 500,
    color: 'var(--text-secondary)',
    cursor: 'pointer',
    transition: 'all 0.15s',
    outline: 'none',
  }

  const iconBtnStyle: React.CSSProperties = {
    width: '28px',
    height: '28px',
    borderRadius: '6px',
    background: 'rgba(255, 255, 255, 0.05)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'var(--text-secondary)',
    cursor: 'pointer',
    transition: 'all 0.15s',
    outline: 'none',
  }

  const handleMouseEnter = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.currentTarget.style.background = 'rgba(79, 158, 255, 0.15)'
    e.currentTarget.style.borderColor = 'rgba(79, 158, 255, 0.35)'
    e.currentTarget.style.color = '#fff'
  }

  const handleMouseLeave = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'
    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)'
    e.currentTarget.style.color = 'var(--text-secondary)'
  }

  return (
    <div
      style={{
        position: 'absolute',
        left: 'calc(var(--sidebar-w) + 24px)',
        bottom: 'calc(var(--timeline-h) + 16px)',
        zIndex: 100,
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
        padding: '6px',
        borderRadius: '10px',
        background: 'rgba(10, 14, 26, 0.85)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        backdropFilter: 'blur(20px)',
        pointerEvents: 'auto',
        boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
      }}
      id="globe-navigation-widget"
    >
      {/* Row 1: Presets / Resets */}
      <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
        <button
          style={iconBtnStyle}
          onClick={goHome}
          title="Fly Home (Full Earth)"
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          <Home size={12} />
        </button>

        <div style={{ width: '1px', height: '14px', background: 'rgba(255,255,255,0.1)', margin: '0 2px' }} />

        <button
          style={btnStyle}
          onClick={() => setTiltPreset('top')}
          title="Top Down 2D View"
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          <Eye size={12} /> 2D Top
        </button>

        <button
          style={btnStyle}
          onClick={() => setTiltPreset('3d')}
          title="Tilted 3D View"
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          <Compass size={12} /> 3D Side
        </button>

        <button
          style={btnStyle}
          onClick={() => setTiltPreset('horizon')}
          title="Horizon Low-Angle View"
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          <Layers size={12} /> Horizon
        </button>
      </div>

      {/* Row 2: Manual Axis Controls (Pan / Rotate / Zoom) */}
      <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
        <button
          style={iconBtnStyle}
          onClick={() => adjustCamera('left')}
          title="Spin West (Y-Axis)"
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          <ArrowLeft size={12} />
        </button>

        <button
          style={iconBtnStyle}
          onClick={() => adjustCamera('right')}
          title="Spin East (Y-Axis)"
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          <ArrowRight size={12} />
        </button>

        <button
          style={iconBtnStyle}
          onClick={() => adjustCamera('up')}
          title="Tilt Up (X-Axis)"
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          <ArrowUp size={12} />
        </button>

        <button
          style={iconBtnStyle}
          onClick={() => adjustCamera('down')}
          title="Tilt Down (X-Axis)"
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          <ArrowDown size={12} />
        </button>

        <div style={{ width: '1px', height: '14px', background: 'rgba(255,255,255,0.1)', margin: '0 2px' }} />

        <button
          style={iconBtnStyle}
          onClick={() => zoomCamera('in')}
          title="Zoom In (Z-Axis)"
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          <ZoomIn size={12} />
        </button>

        <button
          style={iconBtnStyle}
          onClick={() => zoomCamera('out')}
          title="Zoom Out (Z-Axis)"
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          <ZoomOut size={12} />
        </button>
      </div>
    </div>
  )
}
