'use client'

import { useState, useMemo } from 'react'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceArea,
} from 'recharts'
import type { CognitiveSession, CognitiveBenchmark } from '@/types'

type MetricKey = 'mean_rt' | 'speed' | 'accuracy' | 'rcs' | 'variation'
type TimeFilter = '1m' | '3m' | '6m' | '1y' | 'all'

interface CognitiveTrendChartProps {
  sessions: CognitiveSession[]
  metric: MetricKey
  benchmark: CognitiveBenchmark | null
  timeFilter?: TimeFilter
}

const METRIC_LABELS: Record<MetricKey, string> = {
  mean_rt:   'RT moyen (ms)',
  speed:     'Vitesse',
  accuracy:  'Précision (%)',
  rcs:       'Consistance (RCS)',
  variation: 'Variation (CV%)',
}

const TIME_LABELS: Record<TimeFilter, string> = {
  '1m': '1 mois',
  '3m': '3 mois',
  '6m': '6 mois',
  '1y': '1 an',
  'all': 'Tout',
}

function filterByTime(sessions: CognitiveSession[], filter: TimeFilter): CognitiveSession[] {
  if (filter === 'all') return sessions
  const now = new Date()
  const months: Record<TimeFilter, number> = { '1m': 1, '3m': 3, '6m': 6, '1y': 12, 'all': 0 }
  const cutoff = new Date(now)
  cutoff.setMonth(cutoff.getMonth() - months[filter])
  return sessions.filter((s) => s.completed_at && new Date(s.completed_at) >= cutoff)
}

// Calcule les limites des zones benchmark pour les ReferenceArea
function getZoneBounds(benchmark: CognitiveBenchmark) {
  const { direction, elite_max, average_min, average_max } = benchmark

  if (direction === 'lower_is_better') {
    // elite: [0, elite_max], average: [elite_max, average_max], poor: [average_max, +∞]
    return {
      elite:   { y1: 0,              y2: elite_max ?? undefined },
      average: { y1: elite_max ?? 0, y2: average_max ?? undefined },
      poor:    { y1: average_max,    y2: undefined },
    }
  } else {
    // higher_is_better: elite: [elite_max, +∞], average: [average_min, elite_max], poor: [0, average_min]
    return {
      elite:   { y1: elite_max,    y2: undefined },
      average: { y1: average_min,  y2: elite_max ?? undefined },
      poor:    { y1: 0,            y2: average_min ?? undefined },
    }
  }
}

export function CognitiveTrendChart({
  sessions,
  metric,
  benchmark,
  timeFilter: initialFilter = 'all',
}: CognitiveTrendChartProps) {
  const [activeMetric, setActiveMetric] = useState<MetricKey>(metric)
  const [timeFilter, setTimeFilter] = useState<TimeFilter>(initialFilter)

  const metrics: MetricKey[] = ['mean_rt', 'speed', 'accuracy', 'rcs', 'variation']

  const chartData = useMemo(() => {
    const filtered = filterByTime(sessions, timeFilter)
    return filtered
      .filter((s) => s.computed_metrics?.[activeMetric] !== undefined)
      .sort((a, b) => new Date(a.completed_at ?? 0).getTime() - new Date(b.completed_at ?? 0).getTime())
      .map((s) => ({
        date: s.completed_at
          ? new Date(s.completed_at).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })
          : '—',
        value: s.computed_metrics![activeMetric] as number,
      }))
  }, [sessions, activeMetric, timeFilter])

  if (chartData.length < 2) {
    return (
      <div className="flex flex-col gap-3">
        <MetricButtons metrics={metrics} active={activeMetric} onChange={setActiveMetric} />
        <div className="h-40 flex items-center justify-center text-sm text-muted-foreground">
          Pas assez de données pour afficher la tendance
        </div>
      </div>
    )
  }

  const zones = benchmark ? getZoneBounds(benchmark) : null
  const values = chartData.map((d) => d.value)
  const yMin = Math.min(...values) * 0.9
  const yMax = Math.max(...values) * 1.1

  return (
    <div className="flex flex-col gap-3">
      <MetricButtons metrics={metrics} active={activeMetric} onChange={setActiveMetric} />

      <ResponsiveContainer width="100%" height={200}>
        <AreaChart data={chartData} margin={{ top: 8, right: 8, left: -24, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="date" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} domain={[yMin, yMax]} />
          <Tooltip
            contentStyle={{ fontSize: 12 }}
            formatter={(v) => [Number(v).toFixed(2), METRIC_LABELS[activeMetric]]}
          />

          {zones && (
            <>
              {zones.elite.y2 !== undefined && (
                <ReferenceArea y1={zones.elite.y1 ?? yMin} y2={zones.elite.y2 ?? undefined} fill="#20808D" fillOpacity={0.12} />
              )}
              {zones.average.y1 !== undefined && zones.average.y2 !== undefined && (
                <ReferenceArea y1={zones.average.y1 ?? undefined} y2={zones.average.y2 ?? undefined} fill="#FFC553" fillOpacity={0.15} />
              )}
              {zones.poor.y1 !== undefined && (
                <ReferenceArea y1={zones.poor.y1 ?? undefined} y2={zones.poor.y2 ?? yMax} fill="#944454" fillOpacity={0.12} />
              )}
            </>
          )}

          <Area
            type="monotone"
            dataKey="value"
            stroke="#20808D"
            strokeWidth={2}
            fill="#20808D"
            fillOpacity={0.08}
            dot={{ r: 3, fill: '#20808D', strokeWidth: 0 }}
            activeDot={{ r: 5 }}
          />
        </AreaChart>
      </ResponsiveContainer>

      <TimeFilterButtons active={timeFilter} onChange={setTimeFilter} />
    </div>
  )
}

function MetricButtons({
  metrics,
  active,
  onChange,
}: {
  metrics: MetricKey[]
  active: MetricKey
  onChange: (m: MetricKey) => void
}) {
  return (
    <div className="flex flex-wrap gap-1">
      {metrics.map((m) => (
        <button
          key={m}
          onClick={() => onChange(m)}
          className={`px-2 py-0.5 text-xs rounded border transition-colors ${
            active === m
              ? 'bg-[#20808D] text-white border-[#20808D]'
              : 'bg-white text-muted-foreground border-border hover:border-[#20808D]'
          }`}
        >
          {METRIC_LABELS[m]}
        </button>
      ))}
    </div>
  )
}

function TimeFilterButtons({
  active,
  onChange,
}: {
  active: TimeFilter
  onChange: (f: TimeFilter) => void
}) {
  const filters: TimeFilter[] = ['1m', '3m', '6m', '1y', 'all']
  return (
    <div className="flex gap-1 justify-end">
      {filters.map((f) => (
        <button
          key={f}
          onClick={() => onChange(f)}
          className={`px-2 py-0.5 text-xs rounded border transition-colors ${
            active === f
              ? 'bg-[#1A1A2E] text-white border-[#1A1A2E]'
              : 'bg-white text-muted-foreground border-border hover:border-[#1A1A2E]'
          }`}
        >
          {TIME_LABELS[f]}
        </button>
      ))}
    </div>
  )
}
