import { useEffect, useRef, useCallback } from 'react'
import { useGlobeStore } from '../store/useGlobeStore'
import type { WorldEvent } from '../store/useGlobeStore'

const WS_URL = `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}/ws`
const RECONNECT_DELAY_MS = 3000
const MAX_RECONNECT = 10

export function useWebSocket() {
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectCount = useRef(0)
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const addEvent = useGlobeStore((s) => s.addEvent)
  const setWsConnected = useGlobeStore((s) => s.setWsConnected)

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return

    const ws = new WebSocket(`${WS_URL}?layer=*`)
    wsRef.current = ws

    ws.onopen = () => {
      reconnectCount.current = 0
      setWsConnected(true)
      console.info('[WS] Connected')
    }

    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data)
        if (msg.type === 'event') {
          addEvent(msg.data as WorldEvent)
        } else if (msg.type === 'pong') {
          // keepalive ok
        }
      } catch {
        // ignore parse errors
      }
    }

    ws.onclose = () => {
      setWsConnected(false)
      if (reconnectCount.current < MAX_RECONNECT) {
        reconnectCount.current++
        reconnectTimer.current = setTimeout(connect, RECONNECT_DELAY_MS)
      }
    }

    ws.onerror = () => {
      ws.close()
    }
  }, [addEvent, setWsConnected])

  // Ping every 25s to keep alive
  useEffect(() => {
    const ping = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send('ping')
      }
    }, 25000)
    return () => clearInterval(ping)
  }, [])

  useEffect(() => {
    connect()
    return () => {
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current)
      wsRef.current?.close()
    }
  }, [connect])
}
