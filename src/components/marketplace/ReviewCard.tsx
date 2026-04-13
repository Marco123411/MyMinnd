import { StarRating } from './StarRating'
import type { Review } from '@/types'

interface ReviewCardProps {
  review: Review
}

function formatDate(dateStr: string): string {
  return new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(dateStr))
}

export function ReviewCard({ review }: ReviewCardProps) {
  return (
    <div className="py-4 border-b last:border-0">
      <div className="flex items-center justify-between gap-3 mb-2">
        <div className="flex items-center gap-2">
          <StarRating rating={review.rating} size="sm" />
          <span className="text-sm font-medium text-[#141325]">
            {review.reviewer_display_name ?? 'Anonyme'}
          </span>
        </div>
        <span className="text-xs text-muted-foreground shrink-0">
          {formatDate(review.created_at)}
        </span>
      </div>

      {review.comment && (
        <p className="text-sm text-foreground leading-relaxed">{review.comment}</p>
      )}

      {review.expert_response && (
        <div className="mt-3 rounded-md bg-[#F1F0FE] px-4 py-3">
          <p className="text-xs font-semibold text-[#7069F4] mb-1">Réponse de l&apos;expert</p>
          <p className="text-sm text-foreground leading-relaxed">{review.expert_response}</p>
        </div>
      )}
    </div>
  )
}
