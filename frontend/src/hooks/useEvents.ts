import { useQuery } from '@tanstack/react-query'
import { useEffect } from 'react'
import { fetchEvents, fetchStats } from '../api/events'
import { useGlobeStore } from '../store/useGlobeStore'

export function useEvents() {
  const addEvents = useGlobeStore((s) => s.addEvents)
  const severityFilter = useGlobeStore((s) => s.severityFilter)
  const layers = useGlobeStore((s) => s.layers)
  const enabledLayers = layers.filter((l) => l.enabled).map((l) => l.name)

  const { data, isLoading, error } = useQuery({
    queryKey: ['events', severityFilter],
    queryFn: () =>
      fetchEvents({ min_severity: severityFilter, limit: 2000 }),
    refetchInterval: 30000,
    staleTime: 20000,
  })

  useEffect(() => {
    if (data?.events) {
      const filtered = data.events.filter((e) =>
        enabledLayers.includes(e.type as never)
      )
      addEvents(filtered)
    }
  }, [data, addEvents]) // eslint-disable-line react-hooks/exhaustive-deps

  return { isLoading, error }
}

export function useStats() {
  const setStats = useGlobeStore((s) => s.setStats)

  const { data } = useQuery({
    queryKey: ['stats'],
    queryFn: fetchStats,
    refetchInterval: 15000,
  })

  useEffect(() => {
    if (data) setStats(data)
  }, [data, setStats])
}
