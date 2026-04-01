'use client'

import { useRef, useState, useTransition } from 'react'
import { BonhommePerformance } from './BonhommePerformance'
import { FigurePerformance } from './FigurePerformance'
import { saveInteractiveExerciseAction } from '@/app/actions/exercises'

interface Props {
  exerciseType: string
  clientId?: string
  onSaveComplete?: () => void
}

export function InteractiveExerciseRenderer({ exerciseType, clientId, onSaveComplete }: Props) {
  const [isPending, startTransition] = useTransition()
  const [saveError, setSaveError]    = useState<string | null>(null)
  const [saved, setSaved]            = useState(false)
  // F8: garde contre double-clic — ref synchrone pour éviter la race condition
  const isSavingRef = useRef(false)

  function handleSave(data: Record<string, unknown>) {
    if (isSavingRef.current) return
    isSavingRef.current = true
    setSaveError(null)
    startTransition(async () => {
      const { error } = await saveInteractiveExerciseAction(exerciseType, data, clientId)
      if (error) {
        setSaveError(error)
        isSavingRef.current = false
      } else {
        setSaved(true)
        onSaveComplete?.()
      }
    })
  }

  if (saved) {
    return (
      <div className="rounded-lg border border-green-300 bg-green-50 px-6 py-8 text-center">
        <p className="text-green-700 font-semibold text-lg">Exercice enregistré ✓</p>
        <p className="text-green-600 text-sm mt-1">Les résultats ont bien été sauvegardés.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {exerciseType === 'bonhomme_performance' && (
        <BonhommePerformance
          onSave={data => handleSave(data as unknown as Record<string, unknown>)}
          isPending={isPending}
        />
      )}

      {exerciseType === 'figure_performance' && (
        <FigurePerformance
          onSave={data => handleSave(data as unknown as Record<string, unknown>)}
          isPending={isPending}
        />
      )}

      {exerciseType !== 'bonhomme_performance' && exerciseType !== 'figure_performance' && (
        <p className="text-muted-foreground text-sm">
          Exercice interactif non reconnu : <code>{exerciseType}</code>
        </p>
      )}

      {saveError && (
        <p className="text-sm text-red-500 font-medium">{saveError}</p>
      )}
    </div>
  )
}
