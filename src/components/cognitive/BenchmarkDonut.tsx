'use client'

import { useMemo } from 'react'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'

interface BenchmarkDonutProps {
  metric: string
  distribution: { elite: number; average: number; poor: number }
}

const COLORS = {
  elite:   '#20808D',
  average: '#FFC553',
  poor:    '#944454',
}

const LABELS = {
  elite:   'Élite',
  average: 'Moyen',
  poor:    'À développer',
}

export function BenchmarkDonut({ metric, distribution }: BenchmarkDonutProps) {
  const data = useMemo(() => [
    { name: LABELS.elite,   value: distribution.elite,   color: COLORS.elite   },
    { name: LABELS.average, value: distribution.average, color: COLORS.average },
    { name: LABELS.poor,    value: distribution.poor,    color: COLORS.poor    },
  ].filter((d) => d.value > 0), [distribution.elite, distribution.average, distribution.poor])

  return (
    <div className="flex flex-col items-center gap-1">
      <ResponsiveContainer width={160} height={160}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={45}
            outerRadius={70}
            dataKey="value"
            strokeWidth={0}
          >
            {data.map((entry, index) => (
              <Cell key={index} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value) => [`${Number(value).toFixed(1)}%`]}
            contentStyle={{ fontSize: 12 }}
          />
        </PieChart>
      </ResponsiveContainer>
      <span className="text-xs text-muted-foreground text-center">{metric}</span>
    </div>
  )
}
