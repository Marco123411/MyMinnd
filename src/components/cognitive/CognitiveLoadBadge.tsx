'use client'

import { getCognitiveLoadZone, getCognitiveLoadColor } from '@/lib/cognitive/load'

interface CognitiveLoadBadgeProps {
  score: number
}

const ZONE_LABELS = {
  low:      'LOW',
  moderate: 'MODERATE',
  high:     'HIGH',
}

export default function CognitiveLoadBadge({ score }: CognitiveLoadBadgeProps) {
  const zone = getCognitiveLoadZone(score)
  const color = getCognitiveLoadColor(zone)

  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium"
      style={{ backgroundColor: `${color}20`, color }}
      title={`CLS ${score}/26 — ${ZONE_LABELS[zone]}`}
    >
      <span
        className="inline-block h-2 w-2 rounded-full flex-shrink-0"
        style={{ backgroundColor: color }}
        aria-hidden="true"
      />
      {score}
    </span>
  )
}
