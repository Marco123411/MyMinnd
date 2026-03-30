'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { QuestionCard } from '@/components/test/QuestionCard'
import { saveResponseAction, completeTestAction } from '@/app/actions/test'
import type { Question } from '@/types'

interface TestEngineProps {
  testId: string
  testSlug: string
  questions: Question[]
  existingAnswers: Record<string, number>
}

export function TestEngine({ testId, testSlug, questions, existingAnswers }: TestEngineProps) {
  const router = useRouter()
  const [answers, setAnswers] = useState<Record<string, number>>(existingAnswers)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Reprend depuis la première question sans réponse
  const firstUnanswered = questions.findIndex((q) => !(q.id in existingAnswers))
  const [currentIndex, setCurrentIndex] = useState(firstUnanswered === -1 ? 0 : firstUnanswered)

  const handleAnswer = useCallback(
    async (value: number) => {
      const question = questions[currentIndex]
      if (!question || saving) return

      // Mise à jour optimiste
      setAnswers((prev) => ({ ...prev, [question.id]: value }))
      setSaving(true)
      setError(null)

      const { error: saveError } = await saveResponseAction(
        testId,
        question.id,
        value,
        question.is_reversed
      )

      if (saveError) {
        setSaving(false)
        setError(saveError)
        // Annule la mise à jour optimiste
        setAnswers((prev) => {
          const next = { ...prev }
          delete next[question.id]
          return next
        })
        return
      }

      const isLast = currentIndex >= questions.length - 1
      if (!isLast) {
        setSaving(false)
        setCurrentIndex((prev) => prev + 1)
        return
      }

      // Dernière question — finalise le test
      const { error: completeError } = await completeTestAction(testId)
      setSaving(false)
      if (completeError) {
        setError(completeError)
        return
      }
      router.push(`/test/${testSlug}/results/${testId}`)
    },
    [currentIndex, questions, saving, testId, testSlug, router]
  )

  const handlePrevious = useCallback(() => {
    if (currentIndex > 0) setCurrentIndex((prev) => prev - 1)
  }, [currentIndex])

  if (questions.length === 0) {
    return (
      <div className="flex min-h-[calc(100vh-56px)] items-center justify-center px-4">
        <p className="text-muted-foreground">Aucune question disponible pour ce test.</p>
      </div>
    )
  }

  const question = questions[currentIndex]

  return (
    <>
      {error && (
        <div className="fixed left-1/2 top-4 z-50 -translate-x-1/2 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-600 shadow-md">
          {error}
        </div>
      )}
      <div className={saving ? 'pointer-events-none opacity-75' : undefined}>
        <QuestionCard
          questionText={question.text_fr}
          questionIndex={currentIndex + 1}
          total={questions.length}
          currentValue={answers[question.id] ?? null}
          onAnswer={handleAnswer}
          onPrevious={handlePrevious}
          canGoPrevious={currentIndex > 0}
        />
      </div>
    </>
  )
}
