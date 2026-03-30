'use client'

import { ScaleSelector } from '@/components/test/ScaleSelector'
import { TestProgress } from '@/components/test/TestProgress'
import { Button } from '@/components/ui/button'

interface QuestionCardProps {
  questionText: string
  questionIndex: number
  total: number
  currentValue: number | null
  onAnswer: (value: number) => void
  onPrevious: () => void
  canGoPrevious: boolean
}

export function QuestionCard({
  questionText,
  questionIndex,
  total,
  currentValue,
  onAnswer,
  onPrevious,
  canGoPrevious,
}: QuestionCardProps) {
  return (
    <div className="flex min-h-[calc(100vh-56px)] flex-col px-4 py-8">
      <TestProgress current={questionIndex} total={total} className="mb-8" />

      <div className="flex flex-1 flex-col items-center justify-center gap-10">
        <p className="max-w-xl text-center text-2xl font-semibold leading-relaxed text-foreground md:text-3xl">
          {questionText}
        </p>

        <ScaleSelector value={currentValue} onChange={onAnswer} />
      </div>

      {canGoPrevious && (
        <div className="mt-6 flex justify-start">
          <Button variant="ghost" onClick={onPrevious} type="button">
            ← Précédent
          </Button>
        </div>
      )}
    </div>
  )
}
