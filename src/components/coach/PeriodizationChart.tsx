'use client'

import {
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceArea,
} from 'recharts'

export interface PeriodizationPoint {
  sessionIndex: number
  sessionName: string
  totalDurationMin: number
  averageCLS: number
  zone: 'low' | 'moderate' | 'high'
}

interface PeriodizationChartProps {
  data: PeriodizationPoint[]
}

export default function PeriodizationChart({ data }: PeriodizationChartProps) {
  if (data.length < 2) {
    return (
      <div className="flex h-40 items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
        Pas assez de données (minimum 2 sessions)
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={250}>
      <ComposedChart data={data} margin={{ top: 10, right: 30, left: -10, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />

        {/* Zone de fond LOW (CLS 1-7) */}
        <ReferenceArea yAxisId="cls" y1={1} y2={7} fill="#E8F4F5" fillOpacity={0.6} />
        {/* Zone de fond MODERATE (CLS 8-17) */}
        <ReferenceArea yAxisId="cls" y1={8} y2={17} fill="#FFF9E6" fillOpacity={0.6} />
        {/* Zone de fond HIGH (CLS 18-26) */}
        <ReferenceArea yAxisId="cls" y1={18} y2={26} fill="#F5E8EC" fillOpacity={0.6} />

        <XAxis
          dataKey="sessionName"
          tick={{ fontSize: 12 }}
          tickLine={false}
        />
        {/* Axe durée (gauche) */}
        <YAxis
          yAxisId="duration"
          orientation="left"
          tick={{ fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          unit=" min"
        />
        {/* Axe CLS (droite) */}
        <YAxis
          yAxisId="cls"
          orientation="right"
          domain={[1, 26]}
          tick={{ fontSize: 11 }}
          tickLine={false}
          axisLine={false}
        />

        <Tooltip
          content={({ active, payload, label }) => {
            if (!active || !payload?.length) return null
            const point = data.find(d => d.sessionName === label)
            return (
              <div className="rounded-lg border bg-popover p-3 shadow-md text-sm space-y-1">
                <p className="font-semibold">{label}</p>
                {payload.map((entry, i) => (
                  <p key={String(entry.dataKey ?? i)} style={{ color: entry.color ?? '#666' }}>
                    {entry.name}: {entry.value}
                    {entry.dataKey === 'totalDurationMin' ? ' min' : ''}
                  </p>
                ))}
                {point && (
                  <p className="text-muted-foreground text-xs">Zone: {point.zone.toUpperCase()}</p>
                )}
              </div>
            )
          }}
        />
        <Legend />

        {/* Ligne durée totale (teal, pointillée) */}
        <Line
          yAxisId="duration"
          type="monotone"
          dataKey="totalDurationMin"
          name="Durée (min)"
          stroke="#20808D"
          strokeWidth={2}
          strokeDasharray="5 5"
          dot={{ r: 3 }}
          activeDot={{ r: 5 }}
        />
        {/* Ligne CLS moyen (mauve) */}
        <Line
          yAxisId="cls"
          type="monotone"
          dataKey="averageCLS"
          name="CLS moyen"
          stroke="#944454"
          strokeWidth={2}
          dot={{ r: 3 }}
          activeDot={{ r: 5 }}
        />
      </ComposedChart>
    </ResponsiveContainer>
  )
}
