'use client'

import { Star } from 'lucide-react'
import { useState } from 'react'
import { cn } from '@/lib/utils'

interface StarRatingProps {
  rating: number
  onChange?: (rating: number) => void
  size?: 'sm' | 'md' | 'lg'
  showLabel?: boolean
  className?: string
}

const SIZE_CLASSES = {
  sm: 'h-3 w-3',
  md: 'h-4 w-4',
  lg: 'h-6 w-6',
}

export function StarRating({ rating, onChange, size = 'md', showLabel = false, className }: StarRatingProps) {
  const [hovered, setHovered] = useState(0)
  const isInteractive = !!onChange
  const displayRating = isInteractive && hovered > 0 ? hovered : rating

  return (
    <div className={cn('flex items-center gap-0.5', className)}>
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          disabled={!isInteractive}
          onClick={() => onChange?.(star)}
          onMouseEnter={() => isInteractive && setHovered(star)}
          onMouseLeave={() => isInteractive && setHovered(0)}
          className={cn(
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#20808D] rounded-sm',
            isInteractive ? 'cursor-pointer' : 'cursor-default pointer-events-none'
          )}
          aria-label={isInteractive ? `${star} étoile${star > 1 ? 's' : ''}` : undefined}
        >
          <Star
            className={cn(
              SIZE_CLASSES[size],
              'transition-colors',
              star <= displayRating
                ? 'fill-[#FFC553] text-[#FFC553]'
                : isInteractive && star <= hovered
                  ? 'fill-[#FFC553]/70 text-[#FFC553]/70'
                  : 'fill-none text-muted-foreground/40'
            )}
          />
        </button>
      ))}
      {showLabel && rating > 0 && (
        <span className="ml-1 text-sm font-medium text-foreground">
          {rating.toFixed(1)}
        </span>
      )}
    </div>
  )
}
