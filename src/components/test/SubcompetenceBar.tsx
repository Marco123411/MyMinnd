import { cn } from '@/lib/utils'

interface SubcompetenceBarProps {
  name: string
  score: number
  percentile: number | null
  className?: string
}

function getPercentileColor(percentile: number | null): string {
  if (percentile === null) return 'bg-[#FF9F40]'
  if (percentile < 25) return 'bg-red-500'
  if (percentile < 50) return 'bg-orange-400'
  if (percentile < 75) return 'bg-green-500'
  return 'bg-[#7069F4]'
}

export function SubcompetenceBar({ name, score, percentile, className }: SubcompetenceBarProps) {
  const barWidth = `${Math.min(100, (score / 10) * 100)}%`
  const barColor = getPercentileColor(percentile)

  return (
    <div className={cn('space-y-1', className)}>
      <div className="flex justify-between text-sm">
        <span className="truncate text-foreground">{name}</span>
        <span className="ml-2 shrink-0 font-medium text-foreground">{score.toFixed(1)}/10</span>
      </div>
      <div className="h-2 w-full rounded-full bg-gray-100">
        <div className={cn('h-2 rounded-full transition-all', barColor)} style={{ width: barWidth }} />
      </div>
    </div>
  )
}
