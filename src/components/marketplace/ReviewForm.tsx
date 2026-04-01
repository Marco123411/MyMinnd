'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { StarRating } from './StarRating'
import { submitReviewAction } from '@/app/actions/reviews'

interface ReviewFormProps {
  dispatchId: string
  expertName: string
  onSuccess: () => void
}

export function ReviewForm({ dispatchId, expertName, onSuccess }: ReviewFormProps) {
  const [rating, setRating] = useState(0)
  const [comment, setComment] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (rating < 1) {
      setError('Veuillez attribuer une note (1 à 5 étoiles)')
      return
    }
    setError(null)

    startTransition(async () => {
      const result = await submitReviewAction({
        dispatch_id: dispatchId,
        rating,
        comment: comment.trim() || undefined,
      })
      if (result.error) {
        setError(result.error)
      } else {
        onSuccess()
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Note étoiles */}
      <div className="space-y-2">
        <p className="text-sm font-medium">
          Comment évaluez-vous votre expérience avec {expertName} ?
        </p>
        <StarRating
          rating={rating}
          onChange={setRating}
          size="lg"
        />
        {rating > 0 && (
          <p className="text-xs text-muted-foreground">
            {['', 'Mauvaise expérience', 'Expérience médiocre', 'Expérience correcte', 'Bonne expérience', 'Excellente expérience'][rating]}
          </p>
        )}
      </div>

      {/* Commentaire */}
      <div className="space-y-2">
        <label htmlFor="comment" className="text-sm font-medium">
          Commentaire <span className="text-muted-foreground font-normal">(optionnel)</span>
        </label>
        <Textarea
          id="comment"
          placeholder="Partagez votre expérience avec la communauté..."
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          maxLength={500}
          className="resize-none"
          rows={4}
        />
        <p className="text-xs text-muted-foreground text-right">
          {comment.length}/500
        </p>
      </div>

      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}

      <Button
        type="submit"
        disabled={isPending || rating < 1}
        className="w-full bg-[#20808D] hover:bg-[#20808D]/90"
      >
        {isPending ? 'Publication...' : 'Publier mon avis'}
      </Button>
    </form>
  )
}
