import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'

interface ProgressBarProps {
  value: number
  max?: number
  label?: string
  showPercentage?: boolean
  color?: 'teal' | 'mauve' | 'gold'
  className?: string
}

export function ProgressBar({
  value,
  max = 100,
  label,
  showPercentage = false,
  color = 'teal',
  className,
}: ProgressBarProps) {
  const percentage = max <= 0 ? 0 : Math.min(100, Math.round((value / max) * 100))

  return (
    <div className={cn('space-y-1', className)}>
      {(label || showPercentage) && (
        <div className="flex justify-between text-sm">
          {label && <span className="text-muted-foreground">{label}</span>}
          {showPercentage && <span className="font-medium">{percentage}%</span>}
        </div>
      )}
      <Progress
        value={percentage}
        className={cn(
          'h-2',
          color === 'teal' && '[&>div]:bg-teal',
          color === 'mauve' && '[&>div]:bg-mauve',
          color === 'gold' && '[&>div]:bg-gold',
        )}
      />
    </div>
  )
}
