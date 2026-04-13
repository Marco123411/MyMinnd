'use client'

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts'
import { AlertTriangle, TrendingDown, TrendingUp } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import type { CognitiveTestResult } from '@/types'

interface Session {
  completed_at: string
  computed_metrics: CognitiveTestResult | null
}

interface CognitiveEvolutionChartProps {
  sessions: Session[]
  metricKey: keyof CognitiveTestResult
  metricLabel: string
  unit?: string
  // Pour les métriques RT : une baisse est une amélioration
  lowerIsBetter?: boolean
  isValidated?: boolean
  presetName?: string
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}`
}

export function CognitiveEvolutionChart({
  sessions,
  metricKey,
  metricLabel,
  unit = '',
  lowerIsBetter = false,
  isValidated,
  presetName,
}: CognitiveEvolutionChartProps) {
  if (sessions.length < 2) {
    return (
      <p className="text-xs text-muted-foreground text-center py-3">
        Passez le test à nouveau pour voir votre évolution.
      </p>
    )
  }

  const chartData = sessions
    .filter((s) => s.computed_metrics?.[metricKey] !== undefined)
    .map((s) => ({
      date: formatDate(s.completed_at),
      value: s.computed_metrics![metricKey] as number,
    }))
    .reverse() // ordre chronologique

  if (chartData.length < 2) {
    return (
      <p className="text-xs text-muted-foreground text-center py-3">
        Données insuffisantes pour afficher l&apos;évolution.
      </p>
    )
  }

  const first = chartData[0].value
  const last = chartData[chartData.length - 1].value
  // F11: pas d'icône si valeurs égales — évite le faux "dégradation"
  const changed = last !== first
  const improved = lowerIsBetter ? last < first : last > first

  return (
    <div className="space-y-1">
      {presetName && (
        <Badge variant="outline" className="text-xs">{presetName}</Badge>
      )}
      {isValidated === false && (
        <p className="text-xs text-amber-600 flex items-center gap-1">
          <AlertTriangle className="h-3 w-3" />
          Preset non validé — évolution indicative uniquement
        </p>
      )}
      <div className="flex items-center gap-1">
        <span className="text-xs text-muted-foreground">{metricLabel}</span>
        {changed && (improved ? (
          <TrendingUp className="h-3.5 w-3.5 text-green-600" />
        ) : (
          <TrendingDown className="h-3.5 w-3.5 text-red-500" />
        ))}
      </div>
      <ResponsiveContainer width="100%" height={120}>
        <LineChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="currentColor" strokeOpacity={0.1} />
          <XAxis dataKey="date" tick={{ fontSize: 10 }} tickLine={false} />
          <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
          <Tooltip
            formatter={(v) => [`${Math.round(Number(v))} ${unit}`, metricLabel]}
            contentStyle={{ fontSize: 12 }}
          />
          <ReferenceLine y={first} stroke="#F1F0FE" strokeDasharray="4 2" />
          <Line
            type="monotone"
            dataKey="value"
            stroke="#7069F4"
            strokeWidth={2}
            dot={{ fill: '#7069F4', r: 3 }}
            activeDot={{ r: 5 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
