'use client'

import { getCognitiveLoadZone, getCognitiveLoadColor, CLS_LOW_MAX, CLS_MOD_MAX } from '@/lib/cognitive/load'

interface CognitiveLoadBarProps {
  score: number
  max?: number
  showLabel?: boolean
}

export default function CognitiveLoadBar({ score, max = 26, showLabel = true }: CognitiveLoadBarProps) {
  const zone = getCognitiveLoadZone(score)
  const zoneColor = getCognitiveLoadColor(zone)
  const zoneLabel = zone === 'low' ? 'LOW' : zone === 'moderate' ? 'MODERATE' : 'HIGH'

  // Guard against max=1 → denominator=0 (division by zero)
  const denominator = Math.max(max - 1, 1)
  const pct = Math.min(100, Math.max(0, ((score - 1) / denominator) * 100))

  // Zone width percentages (using shared thresholds from load.ts)
  const lowPct  = ((CLS_LOW_MAX - 1) / denominator) * 100
  const modPct  = ((CLS_MOD_MAX - CLS_LOW_MAX) / denominator) * 100
  const highPct = ((max - CLS_MOD_MAX) / denominator) * 100

  return (
    <div className="space-y-1">
      {showLabel && (
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">CLS: {score}/{max}</span>
          <span className="font-medium" style={{ color: zoneColor }}>{zoneLabel}</span>
        </div>
      )}
      <div className="relative h-3 w-full overflow-hidden rounded-full bg-muted">
        {/* Zone background bands */}
        <div
          className="absolute inset-y-0 left-0 opacity-20"
          style={{ width: `${lowPct}%`, backgroundColor: getCognitiveLoadColor('low') }}
        />
        <div
          className="absolute inset-y-0 opacity-20"
          style={{ left: `${lowPct}%`, width: `${modPct}%`, backgroundColor: getCognitiveLoadColor('moderate') }}
        />
        <div
          className="absolute inset-y-0 right-0 opacity-20"
          style={{ left: `${lowPct + modPct}%`, width: `${highPct}%`, backgroundColor: getCognitiveLoadColor('high') }}
        />
        {/* Score fill */}
        <div
          className="absolute inset-y-0 left-0 rounded-full transition-all duration-300"
          style={{
            width: `${pct}%`,
            background: `linear-gradient(to right, ${getCognitiveLoadColor('low')}, ${getCognitiveLoadColor('moderate')}, ${getCognitiveLoadColor('high')})`,
          }}
        />
      </div>
    </div>
  )
}
