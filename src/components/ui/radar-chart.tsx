'use client'

import {
  Radar,
  RadarChart as RechartsRadarChart,
  PolarGrid,
  PolarAngleAxis,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from 'recharts'

export interface RadarDataPoint {
  subject: string
  value: number
  fullMark?: number
}

interface RadarChartProps {
  data?: RadarDataPoint[]
  color?: string
  height?: number
  className?: string
  // Dual-series support for T1/T2 comparison
  data2?: RadarDataPoint[]
  color2?: string
  label1?: string
  label2?: string
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
  data,
  color = '#20808D',
  height = 300,
  className,
  data2,
  color2 = '#944454',
  label1 = 'Test 1',
  label2 = 'Test 2',
}: RadarChartProps) {
  const chartData = data && data.length > 0 ? data : MOCK_DATA

  // Fusionner les deux séries si data2 est fourni
  const mergedData = data2 && data2.length > 0
    ? chartData.map((point) => ({
        ...point,
        value2: data2.find((d) => d.subject === point.subject)?.value ?? 0,
      }))
    : chartData

  const hasDualSeries = Boolean(data2 && data2.length > 0)

  return (
    <div className={className} style={{ width: '100%', height }}>
      <ResponsiveContainer width="100%" height="100%">
        <RechartsRadarChart data={mergedData}>
          <PolarGrid />
          <PolarAngleAxis
            dataKey="subject"
            tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
          />
          <Radar
            name={hasDualSeries ? label1 : 'Score'}
            dataKey="value"
            stroke={color}
            fill={color}
            fillOpacity={0.2}
            strokeWidth={2}
          />
          {hasDualSeries && (
            <Radar
              name={label2}
              dataKey="value2"
              stroke={color2}
              fill={color2}
              fillOpacity={0.15}
              strokeWidth={2}
              strokeDasharray="5 5"
            />
          )}
          {hasDualSeries && <Legend />}
          <Tooltip
            formatter={(value, name, props) => {
              const fullMark = (props as { payload?: { fullMark?: number } }).payload?.fullMark ?? 10
              return [`${Number(value).toFixed(1)} / ${fullMark}`, name]
            }}
          />
        </RechartsRadarChart>
      </ResponsiveContainer>
    </div>
  )
}
