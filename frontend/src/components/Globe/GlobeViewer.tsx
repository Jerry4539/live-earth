import { useEffect, useRef } from 'react'
import {
  Viewer,
  PointGraphics,
  Color,
  Cartesian3,
  Ion,
  OpenStreetMapImageryProvider,
  UrlTemplateImageryProvider,
  ScreenSpaceEventHandler,
  ScreenSpaceEventType,
  defined,
  Cartesian2,
  HeadingPitchRange,
} from 'cesium'
import 'cesium/Build/Cesium/Widgets/widgets.css'
import { useGlobeStore } from '../../store/useGlobeStore'
import type { WorldEvent, EventType } from '../../store/useGlobeStore'

// Suppress Ion token requirement when using OSM
Ion.defaultAccessToken = import.meta.env.VITE_CESIUM_ION_TOKEN || ''

const LAYER_COLORS: Record<EventType, string> = {
  earthquake: '#ff6b35',
  weather:    '#4fc3f7',
  satellite:  '#ce93d8',
  volcano:    '#ff5252',
  wildfire:   '#ffb74d',
  airquality: '#66bb6a',
}

const SEVERITY_SCALE: Record<number, number> = {
  0: 6, 1: 8, 2: 10, 3: 14, 4: 18, 5: 24,
}

interface GlobeViewerProps {
  className?: string
}

export const GlobeViewer: React.FC<GlobeViewerProps> = ({ className }) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const viewerRef = useRef<Viewer | null>(null)

  const events = useGlobeStore((s) => s.events)
  const layers = useGlobeStore((s) => s.layers)
  const severityFilter = useGlobeStore((s) => s.severityFilter)
  const selectedEvent = useGlobeStore((s) => s.selectedEvent)
  const setSelectedEvent = useGlobeStore((s) => s.setSelectedEvent)
  const setViewer = useGlobeStore((s) => s.setViewer)

  // Init Cesium viewer once
  useEffect(() => {
    if (!containerRef.current || viewerRef.current) return

    const viewer = new Viewer(containerRef.current, {
      // @ts-ignore
      baseLayer: false,
      baseLayerPicker: false,
      navigationHelpButton: false,
      animation: false,
      timeline: false,
      fullscreenButton: false,
      geocoder: false,
      homeButton: false,
      sceneModePicker: false,
      selectionIndicator: false,
      infoBox: false,
    })

    // Add Esri World Imagery (Realistic satellite Earth)
    viewer.imageryLayers.removeAll()
    const esriProvider = new UrlTemplateImageryProvider({
      url: 'https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      maximumLevel: 19,
    })
    viewer.imageryLayers.addImageryProvider(esriProvider)

    // Dark atmosphere & space lighting
    viewer.scene.globe.enableLighting = true
    viewer.scene.globe.atmosphereLightIntensity = 8.0
    viewer.scene.globe.showGroundAtmosphere = true
    viewer.scene.globe.baseColor = Color.fromCssColorString('#05070f')
    
    // Enable Sun and Moon
    viewer.scene.sun.show = true
    viewer.scene.moon.show = true

    // Remove Cesium credit display
    // @ts-ignore
    viewer._cesiumWidget._creditContainer.style.display = 'none'

    // Click handler
    const handler = new ScreenSpaceEventHandler(viewer.scene.canvas)
    handler.setInputAction((click: { position: Cartesian2 }) => {
      const picked = viewer.scene.pick(click.position)
      if (defined(picked) && picked.id) {
        // @ts-ignore
        const eventData = picked.id.eventData as WorldEvent
        if (eventData && eventData.id) {
          setSelectedEvent(eventData)
        }
      } else {
        setSelectedEvent(null)
      }
    }, ScreenSpaceEventType.LEFT_CLICK)

    viewerRef.current = viewer
    setViewer(viewer)
    return () => {
      handler.destroy()
      viewer.destroy()
      viewerRef.current = null
      setViewer(null)
    }
  }, [setSelectedEvent, setViewer])

  const replay = useGlobeStore((s) => s.replay)

  // Update entities when events/layers/replay changes
  useEffect(() => {
    const viewer = viewerRef.current
    if (!viewer || viewer.isDestroyed()) return

    viewer.entities.removeAll()

    const enabledTypes = new Set(
      layers.filter((l) => l.enabled).map((l) => l.name)
    )

    const isReplayActive = replay.active && replay.currentTime !== null && replay.startTime !== null
    const replayTimeMs = replay.currentTime ? new Date(replay.currentTime).getTime() : 0
    const startTimeMs = replay.startTime ? new Date(replay.startTime).getTime() : 0

    const visibleEvents = events.filter((e) => {
      if (!enabledTypes.has(e.type)) return false
      if (e.severity < severityFilter) return false
      if (isReplayActive) {
        const eventMs = new Date(e.timestamp).getTime()
        return eventMs >= startTimeMs && eventMs <= replayTimeMs
      }
      return true
    })

    for (const ev of visibleEvents) {
      const color = Color.fromCssColorString(LAYER_COLORS[ev.type] || '#fff')
      const size = SEVERITY_SCALE[ev.severity] ?? 8
      const isSatellite = ev.type === 'satellite'

      const entity = viewer.entities.add({
        id: ev.id,
        position: Cartesian3.fromDegrees(ev.longitude, ev.latitude, isSatellite ? (ev.payload.altitude_km as number ?? 400) * 1000 : 0),
        point: new PointGraphics({
          pixelSize: size,
          color: color.withAlpha(0.85),
          outlineColor: color.withAlpha(0.3),
          outlineWidth: size * 0.6,
          heightReference: isSatellite ? undefined : 1, // CLAMP_TO_GROUND
        }),
      })
      // @ts-ignore
      entity.eventData = ev
    }
  }, [events, layers, severityFilter, replay.active, replay.currentTime, replay.startTime])

  // Camera Fly-To controller for events and search coordinates
  const flyToCoords = useGlobeStore((s) => s.flyToCoords)
  const setFlyToCoords = useGlobeStore((s) => s.setFlyToCoords)

  useEffect(() => {
    const viewer = viewerRef.current
    if (!viewer || viewer.isDestroyed()) return

    // 1. Fly to selected event (centered natively regardless of orientation)
    if (selectedEvent) {
      const entity = viewer.entities.getById(selectedEvent.id)
      if (entity) {
        const isSatellite = selectedEvent.type === 'satellite'
        viewer.flyTo(entity, {
          duration: 2.0,
          offset: new HeadingPitchRange(
            viewer.camera.heading, // Maintain current heading rotation
            isSatellite ? -0.85 : -0.90, // Tilted pitch angle (approx -51 degrees)
            isSatellite ? 2400000.0 : 450000.0 // Range (closer zoom distance centered on screen)
          )
        })
      }
    }

    // 2. Fly to searched location (centered natively)
    if (flyToCoords) {
      const Cesium = (window as any).Cesium
      if (Cesium) {
        const position = Cesium.Cartesian3.fromDegrees(flyToCoords.longitude, flyToCoords.latitude, 0)
        const sphere = new Cesium.BoundingSphere(position, 0.0)
        viewer.camera.flyToBoundingSphere(sphere, {
          duration: 2.2,
          offset: new HeadingPitchRange(
            viewer.camera.heading,
            -0.90,
            450000.0 // Zoom range
          )
        })
      }
      // Clear after triggering fly
      setFlyToCoords(null)
    }
  }, [selectedEvent, flyToCoords, setFlyToCoords])

  return (
    <div
      ref={containerRef}
      className={className}
      style={{ width: '100%', height: '100%' }}
      id="cesium-globe-container"
    />
  )
}
