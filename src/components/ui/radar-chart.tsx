'use client'

import {
  Radar,
  RadarChart as RechartsRadarChart,
  PolarGrid,
  PolarAngleAxis,
  ResponsiveContainer,
  Tooltip,
} from 'recharts'

interface RadarDataPoint {
  subject: string
  value: number
  fullMark?: number
}

interface RadarChartProps {
  data?: RadarDataPoint[]
  color?: string
  height?: number
  className?: string
}

const MOCK_DATA: RadarDataPoint[] = [
  { subject: 'Confiance', value: 7.5, fullMark: 10 },
  { subject: 'Concentration', value: 6.8, fullMark: 10 },
  { subject: 'Gestion émotions', value: 8.2, fullMark: 10 },
  { subject: 'Motivation', value: 7.1, fullMark: 10 },
  { subject: 'Récupération', value: 6.5, fullMark: 10 },
  { subject: 'Leadership', value: 7.9, fullMark: 10 },
]

export function RadarChart({
  data = MOCK_DATA,
  color = '#20808D',
  height = 300,
  className,
}: RadarChartProps) {
  return (
    <div className={className} style={{ width: '100%', height }}>
      <ResponsiveContainer width="100%" height="100%">
        <RechartsRadarChart data={data}>
          <PolarGrid />
          <PolarAngleAxis
            dataKey="subject"
            tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
          />
          <Radar
            name="Score"
            dataKey="value"
            stroke={color}
            fill={color}
            fillOpacity={0.2}
            strokeWidth={2}
          />
          <Tooltip
            formatter={(value) => [`${Number(value).toFixed(1)} / 10`, 'Score']}
          />
        </RechartsRadarChart>
      </ResponsiveContainer>
    </div>
  )
}
