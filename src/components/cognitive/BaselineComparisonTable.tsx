import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { BenchmarkBadge } from './BenchmarkBadge'

export interface BaselineComparisonRow {
  testName: string
  testSlug: string
  metric: string
  preValue: number
  postValue: number
  delta: number
  deltaPercent: number
  improved: boolean
  preBenchmark: 'elite' | 'average' | 'poor'
  postBenchmark: 'elite' | 'average' | 'poor'
}

interface BaselineComparisonTableProps {
  rows: BaselineComparisonRow[]
}

const ZONE_ORDER: Record<'elite' | 'average' | 'poor', number> = { elite: 2, average: 1, poor: 0 }

function ZoneTransitionBadge({
  pre,
  post,
}: {
  pre: 'elite' | 'average' | 'poor'
  post: 'elite' | 'average' | 'poor'
}) {
  if (pre === post) return null
  const improved = ZONE_ORDER[post] > ZONE_ORDER[pre]

  const LABELS: Record<'elite' | 'average' | 'poor', string> = {
    elite: 'Élite', average: 'Moyen', poor: 'À développer',
  }

  return (
    <Badge
      variant="outline"
      className={`text-[10px] px-1 py-0 ml-1 ${improved ? 'border-green-500 text-green-700' : 'border-red-400 text-red-600'}`}
    >
      {LABELS[pre]} → {LABELS[post]}
    </Badge>
  )
}

export function BaselineComparisonTable({ rows }: BaselineComparisonTableProps) {
  const sorted = [...rows].sort((a, b) => Math.abs(b.deltaPercent) - Math.abs(a.deltaPercent))

  if (sorted.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-6">
        Aucune comparaison disponible pour cette baseline.
      </p>
    )
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="text-xs">Test</TableHead>
            <TableHead className="text-xs">Métrique</TableHead>
            <TableHead className="text-xs text-right">Pré</TableHead>
            <TableHead className="text-xs text-right">Post</TableHead>
            <TableHead className="text-xs text-right">Δ</TableHead>
            <TableHead className="text-xs text-right">Δ%</TableHead>
            <TableHead className="text-xs">Zone post</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.map((row, i) => (
            <TableRow key={i}>
              <TableCell className="text-xs font-medium">{row.testName}</TableCell>
              <TableCell className="text-xs text-muted-foreground">{row.metric}</TableCell>
              <TableCell className="text-xs text-right font-mono">{row.preValue.toFixed(1)}</TableCell>
              <TableCell className="text-xs text-right font-mono">{row.postValue.toFixed(1)}</TableCell>
              <TableCell className="text-xs text-right">
                <span className={row.improved ? 'text-green-600' : 'text-red-500'}>
                  {row.delta > 0 ? '+' : ''}{row.delta.toFixed(1)}
                </span>
              </TableCell>
              <TableCell className="text-xs text-right">
                <span
                  className={`inline-flex items-center gap-0.5 font-medium ${
                    row.improved ? 'text-green-600' : row.deltaPercent === 0 ? 'text-muted-foreground' : 'text-red-500'
                  }`}
                >
                  {row.improved ? (
                    <TrendingUp size={12} />
                  ) : row.deltaPercent === 0 ? (
                    <Minus size={12} />
                  ) : (
                    <TrendingDown size={12} />
                  )}
                  {row.deltaPercent > 0 ? '+' : ''}{row.deltaPercent.toFixed(1)}%
                </span>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-1">
                  <BenchmarkBadge zone={row.postBenchmark} size="sm" />
                  <ZoneTransitionBadge pre={row.preBenchmark} post={row.postBenchmark} />
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
