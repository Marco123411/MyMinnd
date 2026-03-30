import { cn } from '@/lib/utils'

interface ScoreDisplayProps {
  score: number
  maxScore?: number
  label?: string
  description?: string
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

function getScoreColor(score: number, max: number): string {
  if (max <= 0) return 'text-muted-foreground'
  const ratio = score / max
  if (ratio >= 0.75) return 'text-teal'
  if (ratio >= 0.5) return 'text-gold'
  return 'text-mauve'
}

export function ScoreDisplay({
  score,
  maxScore = 10,
  label,
  description,
  size = 'md',
  className,
}: ScoreDisplayProps) {
  const scoreColor = getScoreColor(score, maxScore)

  return (
    <div className={cn('flex flex-col items-center text-center', className)}>
      <div
        className={cn(
          'font-bold tabular-nums',
          scoreColor,
          size === 'sm' && 'text-2xl',
          size === 'md' && 'text-4xl',
          size === 'lg' && 'text-6xl',
        )}
      >
        {score.toFixed(1)}
        <span className={cn(
          'text-muted-foreground font-normal',
          size === 'lg' ? 'text-2xl' : 'text-base'
        )}>
          /{maxScore}
        </span>
      </div>
      {label && (
        <p className={cn('font-medium mt-1', size === 'lg' ? 'text-lg' : 'text-sm')}>
          {label}
        </p>
      )}
      {description && (
        <p className="text-sm text-muted-foreground mt-0.5">{description}</p>
      )}
    </div>
  )
}
