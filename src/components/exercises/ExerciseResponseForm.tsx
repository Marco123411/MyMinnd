'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { ScaleSelector } from '@/components/test/ScaleSelector'
import { saveExerciseResponseAction } from '@/app/actions/exercises'
import type { Exercise, ExerciseQuestion, ExerciseResponseItem } from '@/types'

// ============================================================
// Sous-composants de saisie par type de question
// ============================================================

interface OpenQuestionInputProps {
  question: ExerciseQuestion
  value: string
  onChange: (value: string) => void
}

function OpenQuestionInput({ question, value, onChange }: OpenQuestionInputProps) {
  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium">{question.label}</Label>
      <Textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder="Votre réponse..."
        rows={4}
        className="resize-none"
      />
    </div>
  )
}

interface ScaleQuestionInputProps {
  question: ExerciseQuestion
  value: number | null
  onChange: (value: number) => void
}

function ScaleQuestionInput({ question, value, onChange }: ScaleQuestionInputProps) {
  return (
    <div className="space-y-3">
      <Label className="text-sm font-medium">{question.label}</Label>
      <ScaleSelector
        min={question.min ?? 1}
        max={question.max ?? 10}
        value={value}
        onChange={onChange}
        labels={{ min: '1 — Très faible', max: '10 — Excellent' }}
      />
    </div>
  )
}

interface MCQQuestionInputProps {
  question: ExerciseQuestion
  value: string
  onChange: (value: string) => void
}

function MCQQuestionInput({ question, value, onChange }: MCQQuestionInputProps) {
  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium">{question.label}</Label>
      <div className="flex flex-wrap gap-2">
        {(question.options ?? []).map(option => (
          <button
            key={option}
            type="button"
            onClick={() => onChange(option)}
            className={[
              'px-4 py-2 rounded-lg border-2 text-sm font-medium transition-colors',
              value === option
                ? 'border-[#20808D] bg-[#20808D] text-white'
                : 'border-border bg-background text-foreground hover:border-[#20808D] hover:text-[#20808D]',
            ].join(' ')}
          >
            {option}
          </button>
        ))}
      </div>
    </div>
  )
}

// ============================================================
// ExerciseResponseForm — formulaire principal de réponse
// ============================================================

interface ExerciseResponseFormProps {
  exercise: Exercise
  redirectPath?: string
  onSubmit?: () => void
}

export function ExerciseResponseForm({ exercise, redirectPath = '/client/exercises', onSubmit }: ExerciseResponseFormProps) {
  const router = useRouter()
  const redirectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Nettoyer le timer de redirection si le composant est démonté (F9)
  useEffect(() => {
    return () => {
      if (redirectTimerRef.current) clearTimeout(redirectTimerRef.current)
    }
  }, [])

  // État des réponses : question_id → valeur
  const [responses, setResponses] = useState<Record<string, string | number>>({})
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  function setResponse(questionId: string, value: string | number) {
    setResponses(prev => ({ ...prev, [questionId]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    // Validation : toutes les questions doivent avoir une réponse (F8 : vérifier null aussi)
    for (const q of exercise.questions) {
      const val = responses[q.id]
      if (val === undefined || val === null || val === '') {
        setError('Veuillez répondre à toutes les questions avant de valider.')
        return
      }
    }

    // Construire le tableau de réponses
    const responseItems: ExerciseResponseItem[] = exercise.questions.map(q => ({
      question_id: q.id,
      type:        q.type,
      value:       responses[q.id],
    }))

    setIsLoading(true)
    try {
      const result = await saveExerciseResponseAction(exercise.id, responseItems)

      if (result.error) {
        setError(result.error)
        return
      }

      setSaved(true)
      onSubmit?.()
      // Rediriger vers la liste après confirmation (F9 : timer ref pour cleanup)
      redirectTimerRef.current = setTimeout(() => router.push(redirectPath), 2000)
    } catch {
      setError('Une erreur inattendue est survenue. Veuillez réessayer.')
    } finally {
      setIsLoading(false)
    }
  }

  if (saved) {
    return (
      <div className="text-center py-12 space-y-3">
        <div className="text-4xl">✅</div>
        <p className="font-semibold text-[#1A1A2E]">Réponses enregistrées !</p>
        <p className="text-sm text-muted-foreground">Vous allez être redirigé vers vos exercices.</p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* En-tête exercice */}
      <div>
        <h1 className="text-xl font-bold text-[#1A1A2E]">{exercise.titre}</h1>
        {exercise.description && (
          <p className="text-sm text-muted-foreground mt-1">{exercise.description}</p>
        )}
      </div>

      {/* Questions */}
      <div className="space-y-6">
        {exercise.questions.map((q, i) => (
          <Card key={q.id}>
            <CardContent className="pt-5 pb-5">
              <p className="text-xs text-muted-foreground mb-3">Question {i + 1} / {exercise.questions.length}</p>
              {q.type === 'open' && (
                <OpenQuestionInput
                  question={q}
                  value={(responses[q.id] as string) ?? ''}
                  onChange={val => setResponse(q.id, val)}
                />
              )}
              {q.type === 'scale' && (
                <ScaleQuestionInput
                  question={q}
                  value={(responses[q.id] as number) ?? null}
                  onChange={val => setResponse(q.id, val)}
                />
              )}
              {q.type === 'mcq' && (
                <MCQQuestionInput
                  question={q}
                  value={(responses[q.id] as string) ?? ''}
                  onChange={val => setResponse(q.id, val)}
                />
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}

      <Button
        type="submit"
        disabled={isLoading}
        className="w-full bg-[#20808D] hover:bg-[#20808D]/90 text-white"
      >
        {isLoading ? 'Enregistrement...' : 'Valider mes réponses'}
      </Button>
    </form>
  )
}
