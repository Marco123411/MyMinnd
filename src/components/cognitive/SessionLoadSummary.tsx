'use client'

import { computeSessionLoad, getCognitiveLoadColor } from '@/lib/cognitive/load'
import CognitiveLoadBar from './CognitiveLoadBar'

interface SessionLoadSummaryProps {
  exercises: { cognitive_load_score: number | null }[]
}

const ZONE_LABELS = {
  low:      'LOW',
  moderate: 'MOD',
  high:     'HIGH',
}

const ZONE_COLORS = {
  low:      '#20808D',
  moderate: '#FFC553',
  high:     '#944454',
}

export default function SessionLoadSummary({ exercises }: SessionLoadSummaryProps) {
  const summary = computeSessionLoad(exercises)

  if (summary.total === 0) {
    return (
      <div className="rounded-lg border border-dashed p-3 text-center text-sm text-muted-foreground">
        Aucun drill avec charge calculée
      </div>
    )
  }

  const { breakdown } = summary
  const breakdownTotal = breakdown.low + breakdown.moderate + breakdown.high

  return (
    <div className="rounded-lg border bg-card p-3 space-y-2">
      {/* Stats row */}
      <div className="flex items-center justify-between text-sm">
        <div className="flex gap-4">
          <span>
            <span className="text-muted-foreground">Total </span>
            <span className="font-semibold">{summary.total}</span>
          </span>
          <span>
            <span className="text-muted-foreground">Moy. </span>
            <span className="font-semibold">{summary.average}</span>
          </span>
        </div>
        <span
          className="rounded-full px-2 py-0.5 text-xs font-medium"
          style={{
            backgroundColor: `${getCognitiveLoadColor(summary.zone)}20`,
            color: getCognitiveLoadColor(summary.zone),
          }}
        >
          {ZONE_LABELS[summary.zone]}
        </span>
      </div>

      {/* CLS average bar */}
      <CognitiveLoadBar score={Math.round(summary.average)} showLabel={false} />

      {/* Breakdown stacked bar */}
      {breakdownTotal > 0 && (
        <div className="space-y-1">
          <div className="flex h-2 w-full overflow-hidden rounded-full">
            {breakdown.low > 0 && (
              <div
                style={{
                  width: `${(breakdown.low / breakdownTotal) * 100}%`,
                  backgroundColor: ZONE_COLORS.low,
                }}
              />
            )}
            {breakdown.moderate > 0 && (
              <div
                style={{
                  width: `${(breakdown.moderate / breakdownTotal) * 100}%`,
                  backgroundColor: ZONE_COLORS.moderate,
                }}
              />
            )}
            {breakdown.high > 0 && (
              <div
                style={{
                  width: `${(breakdown.high / breakdownTotal) * 100}%`,
                  backgroundColor: ZONE_COLORS.high,
                }}
              />
            )}
          </div>
          <div className="flex gap-3 text-xs text-muted-foreground">
            {breakdown.low > 0 && (
              <span style={{ color: ZONE_COLORS.low }}>{breakdown.low} LOW</span>
            )}
            {breakdown.moderate > 0 && (
              <span style={{ color: ZONE_COLORS.moderate }}>{breakdown.moderate} MOD</span>
            )}
            {breakdown.high > 0 && (
              <span style={{ color: ZONE_COLORS.high }}>{breakdown.high} HIGH</span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
