'use client'

interface RTDisplayProps {
  rt: number | null
  className?: string
}

function getRTColor(rt: number): string {
  if (rt < 200) return '#22c55e' // vert — excellent
  if (rt < 350) return '#7069F4' // teal MINND — bon
  if (rt < 500) return '#FF9F40' // gold MINND — moyen
  return '#ef4444'               // rouge — lapse
}

function getRTLabel(rt: number): string {
  if (rt < 200) return 'Excellent'
  if (rt < 350) return 'Bon'
  if (rt < 500) return 'Moyen'
  return 'Lapse'
}

export function RTDisplay({ rt, className = '' }: RTDisplayProps) {
  if (rt === null) {
    return (
      <div className={`flex flex-col items-center gap-1 ${className}`}>
        <span className="font-mono text-6xl font-bold text-gray-600">—</span>
        <span className="text-sm text-gray-500">En attente</span>
      </div>
    )
  }

  const color = getRTColor(rt)
  const label = getRTLabel(rt)

  return (
    <div className={`flex flex-col items-center gap-1 ${className}`}>
      <span className="font-mono text-6xl font-bold" style={{ color }}>
        {rt}
      </span>
      <span className="text-lg text-gray-400">ms</span>
      <span className="text-sm font-medium" style={{ color }}>
        {label}
      </span>
    </div>
  )
}
