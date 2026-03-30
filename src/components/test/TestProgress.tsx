import { ProgressBar } from '@/components/ui/progress-bar'
import { cn } from '@/lib/utils'

interface TestProgressProps {
  current: number
  total: number
  className?: string
}

export function TestProgress({ current, total, className }: TestProgressProps) {
  return (
    <div className={cn('w-full space-y-1', className)}>
      <ProgressBar value={current} max={total} color="teal" />
      <p className="text-center text-sm text-muted-foreground">
        Question {current} sur {total}
      </p>
    </div>
  )
}
