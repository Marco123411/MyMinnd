import { getAdminMonitoringMetricsAction } from '@/app/actions/admin'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import type { MonitoringMetric } from '@/types'

const FREQUENCY_LABELS: Record<string, string> = {
  quotidien: 'Quotidien',
  hebdo: 'Hebdomadaire',
  mensuel: 'Mensuel',
}

const FREQUENCY_COLORS: Record<string, string> = {
  quotidien: 'bg-[#E8F4F5] text-[#20808D]',
  hebdo: 'bg-blue-50 text-blue-700',
  mensuel: 'bg-[#FFC553]/20 text-[#A84B2F]',
}

function formatValue(value: number | string, unit?: string): string {
  if (typeof value === 'string') return value
  if (unit === '€') return `${value.toLocaleString('fr-FR')} €`
  if (unit === '%') return `${value}%`
  if (unit === 'min') {
    if (value < 60) return `${value} min`
    const h = Math.floor(value / 60)
    const m = value % 60
    return m > 0 ? `${h}h${m}` : `${h}h`
  }
  return value.toLocaleString('fr-FR')
}

function MetricCard({ label, value, previous, unit, frequency, delta_pct }: MonitoringMetric) {
  const isLowerBetter = label.toLowerCase().includes('churn') || label.toLowerCase().includes('temps moyen')
  const isPositive = delta_pct !== null && delta_pct > 0
  const isNegative = delta_pct !== null && delta_pct < 0

  const trendColor = delta_pct === null
    ? 'text-muted-foreground'
    : isLowerBetter
      ? (isNegative ? 'text-green-600' : isPositive ? 'text-red-500' : 'text-muted-foreground')
      : (isPositive ? 'text-green-600' : isNegative ? 'text-red-500' : 'text-muted-foreground')

  const TrendIcon = delta_pct === null
    ? Minus
    : isPositive
      ? TrendingUp
      : isNegative
        ? TrendingDown
        : Minus

  return (
    <Card>
      <CardHeader className="pb-2 flex flex-row items-start justify-between gap-2">
        <CardTitle className="text-sm font-medium text-muted-foreground leading-snug">
          {label}
        </CardTitle>
        <Badge
          variant="outline"
          className={`text-xs shrink-0 border-0 ${FREQUENCY_COLORS[frequency] ?? ''}`}
        >
          {FREQUENCY_LABELS[frequency] ?? frequency}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-1">
        <p className="text-2xl font-bold text-[#1A1A2E]">
          {formatValue(value, unit)}
        </p>
        <div className={`flex items-center gap-1 text-xs ${trendColor}`}>
          <TrendIcon className="h-3 w-3" />
          {delta_pct !== null ? (
            <span>
              {delta_pct > 0 ? '+' : ''}{delta_pct}% vs période précédente
            </span>
          ) : (
            <span className="text-muted-foreground">
              Précédent : {formatValue(previous, unit)}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

export default async function AdminMonitoringPage() {
  const { data: metrics, error } = await getAdminMonitoringMetricsAction()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-[#1A1A2E]">Monitoring plateforme</h1>
        <p className="text-muted-foreground">
          Métriques clés de la plateforme MINND avec évolution par période
        </p>
      </div>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700 text-sm">
          Erreur : {error}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {metrics.map((metric) => (
            <MetricCard
              key={metric.key}
              label={metric.label}
              value={metric.value}
              previous={metric.previous}
              unit={metric.unit}
              frequency={metric.frequency}
              delta_pct={metric.delta_pct}
            />
          ))}
        </div>
      )}
    </div>
  )
}
