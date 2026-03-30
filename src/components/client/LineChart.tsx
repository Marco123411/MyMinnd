'use client'

import { useRouter } from 'next/navigation'
import {
  LineChart as RechartsLineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Dot,
} from 'recharts'

interface DataPoint {
  date: string
  score: number
  testId: string
}

interface LineChartProps {
  data: DataPoint[]
  color?: string
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'short',
  })
}

interface CustomDotProps {
  cx?: number
  cy?: number
  payload?: DataPoint
  onClick?: (testId: string) => void
}

function CustomDot({ cx, cy, payload, onClick }: CustomDotProps) {
  if (cx === undefined || cy === undefined || !payload) return null
  return (
    <Dot
      cx={cx}
      cy={cy}
      r={5}
      fill="#20808D"
      stroke="#fff"
      strokeWidth={2}
      className="cursor-pointer"
      onClick={() => onClick?.(payload.testId)}
    />
  )
}

export function LineChart({ data, color = '#20808D' }: LineChartProps) {
  const router = useRouter()

  const chartData = data.map((d) => ({
    ...d,
    label: formatDate(d.date),
  }))

  return (
    <div style={{ width: '100%', height: 200 }}>
      <ResponsiveContainer width="100%" height="100%">
        <RechartsLineChart data={chartData} margin={{ top: 8, right: 16, left: -16, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis
            dataKey="label"
            tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
            tickLine={false}
          />
          <YAxis
            domain={[0, 10]}
            ticks={[0, 2, 4, 6, 8, 10]}
            tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            formatter={(value) => [`${Number(value ?? 0).toFixed(1)}/10`, 'Score global']}
            labelFormatter={(label) => `Date : ${label}`}
            contentStyle={{
              background: 'hsl(var(--popover))',
              border: '1px solid hsl(var(--border))',
              borderRadius: '8px',
              fontSize: 12,
            }}
          />
          <Line
            type="monotone"
            dataKey="score"
            stroke={color}
            strokeWidth={2}
            dot={(props: CustomDotProps) => (
              <CustomDot
                key={`dot-${props.payload?.testId}`}
                {...props}
                onClick={(testId) => router.push(`/client/results/${testId}`)}
              />
            )}
            activeDot={{ r: 7, fill: color }}
          />
        </RechartsLineChart>
      </ResponsiveContainer>
    </div>
  )
}
