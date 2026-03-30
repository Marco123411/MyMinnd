'use client'

import { cn } from '@/lib/utils'

interface ScaleSelectorProps {
  min?: number
  max?: number
  value: number | null
  onChange: (value: number) => void
  labels?: { min: string; max: string }
}

export function ScaleSelector({
  min = 1,
  max = 10,
  value,
  onChange,
  labels = { min: "Pas du tout d'accord", max: 'Tout à fait d\'accord' },
}: ScaleSelectorProps) {
  const numbers = Array.from({ length: max - min + 1 }, (_, i) => min + i)

  return (
    <div className="w-full space-y-3">
      <div className="flex flex-wrap justify-center gap-2">
        {numbers.map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            aria-label={String(n)}
            aria-pressed={value === n}
            className={cn(
              'h-12 w-12 rounded-full border-2 text-base font-semibold transition-colors',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-[#20808D] focus-visible:ring-offset-2',
              value === n
                ? 'border-[#20808D] bg-[#20808D] text-white'
                : 'border-[#20808D] bg-white text-[#20808D] hover:bg-[#E8F4F5]'
            )}
          >
            {n}
          </button>
        ))}
      </div>
      {labels && (
        <div className="flex justify-between px-1 text-xs text-muted-foreground">
          <span className="max-w-[45%] text-left">{labels.min}</span>
          <span className="max-w-[45%] text-right">{labels.max}</span>
        </div>
      )}
    </div>
  )
}
