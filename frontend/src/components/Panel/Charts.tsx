import React, { useMemo } from 'react'
import ReactECharts from 'echarts-for-react'
import { useGlobeStore } from '../../store/useGlobeStore'

const LAYER_COLORS: Record<string, string> = {
  earthquake: '#ff6b35',
  weather:    '#4fc3f7',
  satellite:  '#ce93d8',
  volcano:    '#ff5252',
  wildfire:   '#ffb74d',
  airquality: '#66bb6a',
}

export const Charts: React.FC = () => {
  const stats = useGlobeStore((s) => s.stats)
  const events = useGlobeStore((s) => s.events)
  const replay = useGlobeStore((s) => s.replay)

  const isReplayActive = replay.active && replay.currentTime !== null && replay.startTime !== null
  const replayTimeMs = replay.currentTime ? new Date(replay.currentTime).getTime() : 0
  const startTimeMs = replay.startTime ? new Date(replay.startTime).getTime() : 0

  // Filter events based on replay if active
  const filteredEvents = useMemo(() => {
    if (!isReplayActive) return events
    return events.filter((e) => {
      const eventMs = new Date(e.timestamp).getTime()
      return eventMs >= startTimeMs && eventMs <= replayTimeMs
    })
  }, [events, isReplayActive, startTimeMs, replayTimeMs])

  // Calculate dynamic stats for pie chart based on filtered events when replay is active
  const pieData = useMemo(() => {
    if (isReplayActive) {
      const counts: Record<string, number> = {}
      for (const e of filteredEvents) {
        counts[e.type] = (counts[e.type] || 0) + 1
      }
      return Object.entries(counts).map(([name, value]) => ({
        name,
        value,
        itemStyle: { color: LAYER_COLORS[name] || '#888' },
      }))
    }

    // Default live stats from API
    return Object.entries(stats).map(([name, value]) => ({
      name,
      value,
      itemStyle: { color: LAYER_COLORS[name] || '#888' },
    }))
  }, [stats, filteredEvents, isReplayActive])

  const timelineData = useMemo(() => {
    // Last 24 hours bucketed by hour (centered around replayTimeMs or Date.now)
    const now = isReplayActive ? replayTimeMs : Date.now()
    const buckets: Record<string, number> = {}
    for (let h = 23; h >= 0; h--) {
      const key = new Date(now - h * 3600000).getHours() + ':00'
      buckets[key] = 0
    }
    for (const e of filteredEvents.slice(0, 500)) {
      const hr = new Date(e.timestamp).getHours() + ':00'
      if (hr in buckets) buckets[hr]++
    }
    return Object.entries(buckets)
  }, [filteredEvents, isReplayActive, replayTimeMs])

  if (pieData.length === 0) return null

  const pieOption = {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'item',
      backgroundColor: 'rgba(15,21,38,0.95)',
      borderColor: 'rgba(255,255,255,0.08)',
      textStyle: { color: '#fff', fontSize: 12, fontFamily: 'Inter' },
    },
    series: [{
      type: 'pie',
      radius: ['45%', '70%'],
      center: ['50%', '50%'],
      data: pieData,
      label: {
        show: true,
        fontSize: 10,
        color: 'rgba(255,255,255,0.6)',
        fontFamily: 'Inter',
        formatter: '{b}: {c}',
      },
      emphasis: {
        itemStyle: { shadowBlur: 10, shadowOffsetX: 0, shadowColor: 'rgba(0,0,0,0.5)' },
      },
    }],
  }

  const barOption = {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(15,21,38,0.95)',
      borderColor: 'rgba(255,255,255,0.08)',
      textStyle: { color: '#fff', fontSize: 11, fontFamily: 'Inter' },
    },
    grid: { top: 10, bottom: 20, left: 30, right: 10 },
    xAxis: {
      type: 'category',
      data: timelineData.map(([h]) => h),
      axisLine: { lineStyle: { color: 'rgba(255,255,255,0.15)' } },
      axisLabel: { color: 'rgba(255,255,255,0.4)', fontSize: 9, fontFamily: 'JetBrains Mono' },
      splitLine: { show: false },
    },
    yAxis: {
      type: 'value',
      axisLine: { show: false },
      axisLabel: { color: 'rgba(255,255,255,0.4)', fontSize: 9 },
      splitLine: { lineStyle: { color: 'rgba(255,255,255,0.05)' } },
    },
    series: [{
      type: 'bar',
      data: timelineData.map(([, v]) => v),
      itemStyle: {
        color: {
          type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
          colorStops: [
            { offset: 0, color: '#4f9eff' },
            { offset: 1, color: '#4f9eff30' },
          ],
        },
        borderRadius: [3, 3, 0, 0],
      },
    }],
  }

  return (
    <div className="card fade-in" style={{ padding: '14px' }} id="charts-panel">
      <h3 style={{ marginBottom: '12px' }}>Analytics</h3>

      <div style={{ marginBottom: '8px' }}>
        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Events by type</span>
        <ReactECharts option={pieOption} style={{ height: '150px' }} />
      </div>

      <div>
        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Activity (24h)</span>
        <ReactECharts option={barOption} style={{ height: '100px' }} />
      </div>
    </div>
  )
}
