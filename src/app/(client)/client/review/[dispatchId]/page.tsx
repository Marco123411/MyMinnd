'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { CheckCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ReviewForm } from '@/components/marketplace/ReviewForm'
import { getReviewableDispatchAction } from '@/app/actions/reviews'

export default function ReviewPage() {
  const params = useParams<{ dispatchId: string }>()
  const dispatchId = params.dispatchId

  const [state, setState] = useState<
    | { status: 'loading' }
    | { status: 'eligible'; expertName: string; completedAt: string }
    | { status: 'error'; message: string }
    | { status: 'done'; expertName: string }
  >({ status: 'loading' })

  useEffect(() => {
    getReviewableDispatchAction(dispatchId).then(({ data, error }) => {
      if (error || !data) {
        setState({ status: 'error', message: error ?? 'Session introuvable' })
      } else {
        setState({ status: 'eligible', expertName: data.expertName, completedAt: data.completedAt })
      }
    })
  }, [dispatchId])

  if (state.status === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="h-8 w-8 rounded-full border-2 border-[#20808D] border-t-transparent animate-spin" />
      </div>
    )
  }

  if (state.status === 'error') {
    return (
      <div className="max-w-lg mx-auto px-4 py-16 text-center">
        <p className="text-lg font-medium text-[#1A1A2E] mb-2">Impossible d&apos;accéder à ce formulaire</p>
        <p className="text-muted-foreground mb-6">{state.message}</p>
        <Button asChild variant="outline">
          <Link href="/client">Retour à mon espace</Link>
        </Button>
      </div>
    )
  }

  if (state.status === 'done') {
    return (
      <div className="max-w-lg mx-auto px-4 py-16 text-center">
        <div className="flex justify-center mb-4">
          <CheckCircle className="h-16 w-16 text-[#20808D]" />
        </div>
        <h1 className="text-2xl font-bold text-[#1A1A2E] mb-2">Merci pour votre avis !</h1>
        <p className="text-muted-foreground mb-8">
          Votre retour aide {state.expertName} et la communauté MINND.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button asChild variant="outline">
            <Link href="/client">Retour à mon espace</Link>
          </Button>
        </div>
      </div>
    )
  }

  // Status: eligible
  const completedDate = state.completedAt
    ? new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(state.completedAt))
    : null

  return (
    <div className="max-w-lg mx-auto px-4 py-10">
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-bold text-[#1A1A2E] mb-2">
          Votre avis sur {state.expertName}
        </h1>
        {completedDate && (
          <p className="text-muted-foreground text-sm">
            Session terminée le {completedDate}
          </p>
        )}
      </div>

      <ReviewForm
        dispatchId={dispatchId}
        expertName={state.expertName}
        onSuccess={() =>
          setState({ status: 'done', expertName: state.status === 'eligible' ? state.expertName : '' })
        }
      />
    </div>
  )
}
