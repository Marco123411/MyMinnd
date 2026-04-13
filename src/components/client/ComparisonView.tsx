'use client'

import { X, TrendingUp, TrendingDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { RadarChart } from '@/components/ui/radar-chart'
import type { RadarDataPoint } from '@/components/ui/radar-chart'

interface LeafScore {
  nodeId: string
  name: string
  score: number
  percentile: number | null
}

interface TestSnapshot {
  id: string
  date: string
  scoreGlobal: number | null
  radarData: RadarDataPoint[]
  leafScores: LeafScore[]
}

interface ComparisonViewProps {
  t1: TestSnapshot
  t2: TestSnapshot
  onClose: () => void
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export function ComparisonView({ t1, t2, onClose }: ComparisonViewProps) {
  // Delta score global — utilise le score stocké en base (moyenne de TOUTES les feuilles, NON-NÉGOCIABLE)
  const deltaGlobal = t1.scoreGlobal !== null && t2.scoreGlobal !== null
    ? t2.scoreGlobal - t1.scoreGlobal
    : null

  // Calcul des deltas par sous-compétence
  type LeafDelta = { name: string; delta: number }
  const leafDeltas: LeafDelta[] = t1.leafScores
    .map((leaf1) => {
      const leaf2 = t2.leafScores.find((l) => l.nodeId === leaf1.nodeId)
      if (!leaf2) return null
      return { name: leaf1.name, delta: leaf2.score - leaf1.score }
    })
    .filter((d): d is LeafDelta => d !== null)
    .sort((a, b) => b.delta - a.delta)

  const top3Progressions = leafDeltas.filter((d) => d.delta > 0).slice(0, 3)
  const top3Regressions = leafDeltas.filter((d) => d.delta < 0).slice(-3).reverse()

  return (
    <div className="rounded-xl border bg-card p-5 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-[#141325]">Comparaison T1 / T2</h3>
        <Button variant="ghost" size="sm" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Légende dates */}
      <div className="flex gap-4 text-sm">
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded-full bg-[#7069F4]" />
          <span className="text-muted-foreground">T1 — {formatDate(t1.date)}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded-full border-2 border-[#3C3CD6]" />
          <span className="text-muted-foreground">T2 — {formatDate(t2.date)}</span>
        </div>
      </div>

      {/* Delta global */}
      {deltaGlobal !== null && (
        <div className="flex items-center justify-center gap-2">
          {deltaGlobal >= 0 ? (
            <TrendingUp className="h-5 w-5 text-green-600" />
          ) : (
            <TrendingDown className="h-5 w-5 text-red-500" />
          )}
          <span
            className={`text-2xl font-bold ${
              deltaGlobal >= 0 ? 'text-green-600' : 'text-red-500'
            }`}
          >
            {deltaGlobal >= 0 ? '+' : ''}{deltaGlobal.toFixed(2)}
          </span>
          <span className="text-sm text-muted-foreground">évolution du score</span>
        </div>
      )}

      {/* Radar superposé */}
      {t1.radarData.length > 0 && t2.radarData.length > 0 && (
        <RadarChart
          data={t1.radarData}
          data2={t2.radarData}
          label1={`T1 — ${formatDate(t1.date)}`}
          label2={`T2 — ${formatDate(t2.date)}`}
          height={260}
        />
      )}

      {/* Progressions & Régressions */}
      {leafDeltas.length > 0 && (
        <div className="grid grid-cols-2 gap-4">
          {top3Progressions.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-green-700 mb-2 uppercase tracking-wide">
                Top progressions
              </p>
              <ul className="space-y-1.5">
                {top3Progressions.map((d) => (
                  <li key={d.name} className="flex items-center justify-between text-sm">
                    <span className="truncate text-foreground">{d.name}</span>
                    <span className="ml-2 shrink-0 font-medium text-green-600">
                      +{d.delta.toFixed(1)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {top3Regressions.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-red-600 mb-2 uppercase tracking-wide">
                Points de vigilance
              </p>
              <ul className="space-y-1.5">
                {top3Regressions.map((d) => (
                  <li key={d.name} className="flex items-center justify-between text-sm">
                    <span className="truncate text-foreground">{d.name}</span>
                    <span className="ml-2 shrink-0 font-medium text-red-500">
                      {d.delta.toFixed(1)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
