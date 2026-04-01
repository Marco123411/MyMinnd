'use client'

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'

interface TrialData {
  reaction_time_ms: number | null
  is_anticipation: boolean | null
}

interface RTHistogramProps {
  trials: TrialData[]
  title?: string
}

// Regroupe les RTs en intervalles de 50ms
function buildBuckets(rts: number[]): { label: string; count: number }[] {
  if (rts.length === 0) return []

  const max = Math.min(Math.max(...rts), 1200)
  const buckets: Record<string, number> = {}

  for (let start = 0; start <= max; start += 50) {
    const label = `${start}`
    buckets[label] = 0
  }

  for (const rt of rts) {
    const bucket = Math.floor(Math.min(rt, 1200) / 50) * 50
    buckets[`${bucket}`] = (buckets[`${bucket}`] ?? 0) + 1
  }

  return Object.entries(buckets).map(([label, count]) => ({
    label: `${label}ms`,
    count,
  }))
}

export function RTHistogram({ trials, title }: RTHistogramProps) {
  const validRts = trials
    .filter((t) => !t.is_anticipation && t.reaction_time_ms !== null)
    .map((t) => t.reaction_time_ms as number)

  const buckets = buildBuckets(validRts)
  // F9: exclure les anticipations du comptage des lapses
  const lapseCount = trials.filter((t) => !t.is_anticipation && t.reaction_time_ms !== null && t.reaction_time_ms >= 500).length

  if (validRts.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-4">
        Aucun trial valide disponible.
      </p>
    )
  }

  return (
    <div className="space-y-2">
      {title && (
        <p className="text-xs text-muted-foreground uppercase tracking-wide">{title}</p>
      )}
      <ResponsiveContainer width="100%" height={160}>
        <BarChart data={buckets} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="currentColor" strokeOpacity={0.1} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 10 }}
            interval={3}
            tickLine={false}
          />
          <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
          <Tooltip
            contentStyle={{ fontSize: 12 }}
            formatter={(value) => [`${value} trials`, 'Nombre']}
          />
          <Bar dataKey="count" fill="#20808D" radius={[2, 2, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
      {lapseCount > 0 && (
        <p className="text-xs text-muted-foreground">
          {lapseCount} lapse{lapseCount > 1 ? 's' : ''} ≥ 500ms
        </p>
      )}
    </div>
  )
}
