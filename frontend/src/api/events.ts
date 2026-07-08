import { apiClient } from './client'
import type { WorldEvent } from '../store/useGlobeStore'

interface EventsResponse {
  count: number
  events: WorldEvent[]
}

interface EventsParams {
  type?: string
  min_severity?: number
  lat_min?: number
  lat_max?: number
  lon_min?: number
  lon_max?: number
  since?: string
  until?: string
  limit?: number
  offset?: number
}

export const fetchEvents = async (params: EventsParams = {}): Promise<EventsResponse> => {
  const { data } = await apiClient.get<EventsResponse>('/events', { params })
  return data
}

export const fetchEvent = async (id: string): Promise<WorldEvent> => {
  const { data } = await apiClient.get<WorldEvent>(`/events/${id}`)
  return data
}

export interface ReplayResponse {
  since: string
  until: string
  count: number
  events: WorldEvent[]
}

export const fetchReplay = async (preset?: string, since?: string, until?: string): Promise<ReplayResponse> => {
  const { data } = await apiClient.get<ReplayResponse>('/replay', {
    params: { preset, since, until, limit: 2000 },
  })
  return data
}

export const fetchStats = async (): Promise<Record<string, number>> => {
  const { data } = await apiClient.get<{ events_by_type: Record<string, number> }>('/stats')
  return data.events_by_type
}
