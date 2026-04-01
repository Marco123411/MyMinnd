'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CognitiveTestShell } from './CognitiveTestShell'
import { useTrialRecorder } from '@/hooks/useTrialRecorder'
import { completeCognitiveSessionAction } from '@/app/actions/cognitive'
import { shuffle } from '@/lib/cognitive/shuffle'
import type { SimonConfig } from '@/types'

interface SimonTestProps {
  sessionId: string
  config: SimonConfig
}

type Phase = 'fixation' | 'stimulus' | 'feedback' | 'complete'
type Side = 'left' | 'right'
type Color = 'rouge' | 'bleu'
type Condition = 'congruent' | 'incongruent'

interface SimonTrial {
  color: Color      // rouge → réponse gauche, bleu → réponse droite
  position: Side    // position visuelle du stimulus
  correctSide: Side
  condition: Condition
}

// Règle Simon : rouge → gauche, bleu → droite
const CORRECT_SIDE: Record<Color, Side> = { rouge: 'left', bleu: 'right' }

function generateTrials(trialsPerCondition: number): SimonTrial[] {
  const trials: SimonTrial[] = []
  const colors: Color[] = ['rouge', 'bleu']

  for (let i = 0; i < trialsPerCondition; i++) {
    for (const color of colors) {
      const correctSide = CORRECT_SIDE[color]
      // Congruent : position = côté correct
      trials.push({ color, position: correctSide, correctSide, condition: 'congruent' })
      // Incongruent : position = côté opposé
      const opposite: Side = correctSide === 'left' ? 'right' : 'left'
      trials.push({ color, position: opposite, correctSide, condition: 'incongruent' })
    }
  }

  return shuffle(trials)
}

export function SimonTest({ sessionId, config }: SimonTestProps) {
  const router = useRouter()
  const { recordTrial, flush } = useTrialRecorder(sessionId)

  const trials = useMemo(
    () => generateTrials(Math.floor((config.trials_per_condition ?? 30) / 2)),
    [config.trials_per_condition]
  )
  const totalTrials = trials.length

  const [phase, setPhase] = useState<Phase>('fixation')
  const [currentIndex, setCurrentIndex] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [feedbackCorrect, setFeedbackCorrect] = useState<boolean | null>(null)

  const phaseRef = useRef<Phase>('fixation')
  const currentIndexRef = useRef(0)
  const phaseStartRef = useRef(0)
  const stimulusShownAtRef = useRef(0)
  const rafIdRef = useRef(0)
  const isCompletingRef = useRef(false)
  const isRespondingRef = useRef(false)

  const fixationDuration = config.fixation_duration_ms ?? 500
  const timeoutMs = config.timeout_ms ?? 3000
  const feedbackDuration = 300

  const completeSession = useCallback(async () => {
    if (isCompletingRef.current) return
    isCompletingRef.current = true
    cancelAnimationFrame(rafIdRef.current)
    await flush()
    const { error: e } = await completeCognitiveSessionAction(sessionId)
    if (e) { setError(e); return }
    router.push(`/test/cognitive/simon/results/${sessionId}`)
  }, [sessionId, flush, router])

  const rafLoop = useCallback(
    (timestamp: number) => {
      const phase = phaseRef.current
      const elapsed = timestamp - phaseStartRef.current

      if (phase === 'fixation') {
        if (elapsed >= fixationDuration) {
          phaseRef.current = 'stimulus'
          setPhase('stimulus')
          stimulusShownAtRef.current = performance.now()
          phaseStartRef.current = timestamp
          isRespondingRef.current = false
        }
      } else if (phase === 'stimulus') {
        if (elapsed >= timeoutMs) {
          const idx = currentIndexRef.current
          recordTrial({
            trial_index: idx,
            stimulus_type: trials[idx].condition,
            stimulus_data: { color: trials[idx].color, position: trials[idx].position },
            response_data: null,
            reaction_time_ms: null,
            is_correct: false,
            is_anticipation: false,
            is_lapse: false,
          })
          setFeedbackCorrect(false)
          phaseRef.current = 'feedback'
          setPhase('feedback')
          phaseStartRef.current = timestamp
        }
      } else if (phase === 'feedback') {
        if (elapsed >= feedbackDuration) {
          const nextIndex = currentIndexRef.current + 1
          if (nextIndex >= totalTrials) {
            completeSession()
            return
          }
          currentIndexRef.current = nextIndex
          setCurrentIndex(nextIndex)
          setFeedbackCorrect(null)
          phaseRef.current = 'fixation'
          setPhase('fixation')
          phaseStartRef.current = timestamp
        }
      }

      rafIdRef.current = requestAnimationFrame(rafLoop)
    },
    [fixationDuration, timeoutMs, feedbackDuration, totalTrials, trials, recordTrial, completeSession]
  )

  useEffect(() => {
    phaseRef.current = 'fixation'
    phaseStartRef.current = performance.now()
    rafIdRef.current = requestAnimationFrame(rafLoop)
    return () => cancelAnimationFrame(rafIdRef.current)
  }, [rafLoop])

  const handleSideResponse = useCallback(
    (chosen: Side) => {
      if (phaseRef.current !== 'stimulus' || isRespondingRef.current) return
      isRespondingRef.current = true

      const rt = Math.round(performance.now() - stimulusShownAtRef.current)
      const idx = currentIndexRef.current
      const trial = trials[idx]
      const isCorrect = chosen === trial.correctSide

      recordTrial({
        trial_index: idx,
        stimulus_type: trial.condition,
        stimulus_data: { color: trial.color, position: trial.position },
        response_data: { chosen_side: chosen },
        reaction_time_ms: rt,
        is_correct: isCorrect,
        is_anticipation: false,
        is_lapse: false,
      })

      setFeedbackCorrect(isCorrect)
      phaseRef.current = 'feedback'
      setPhase('feedback')
      phaseStartRef.current = performance.now()
    },
    [trials, recordTrial]
  )

  // Raccourcis clavier : flèches ou Q/D
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' || e.key.toLowerCase() === 'q') handleSideResponse('left')
      if (e.key === 'ArrowRight' || e.key.toLowerCase() === 'd') handleSideResponse('right')
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleSideResponse])

  const handleAbandon = useCallback(async () => {
    cancelAnimationFrame(rafIdRef.current)
    router.push('/client')
  }, [router])

  const currentTrial = trials[currentIndex]
  const progressValue = (currentIndex / totalTrials) * 100

  if (error) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-gray-950 text-white">
        <p className="text-red-400">{error}</p>
      </div>
    )
  }

  const stimulusColor = currentTrial?.color === 'rouge' ? '#ef4444' : '#3b82f6'
  const stimulusLeft = currentTrial?.position === 'left' ? '30%' : '70%'

  return (
    <CognitiveTestShell
      title="Simon Task"
      progressValue={progressValue}
      progressLabel={`Trial ${currentIndex + 1} / ${totalTrials}`}
      onAbandon={handleAbandon}
    >
      <div className="relative w-full h-full flex flex-col">
        {/* Zone stimulus (plein écran divisé pour le mobile) */}
        <div className="flex-1 relative">
          {/* Zones de tap mobile invisibles */}
          <button
            className="absolute inset-y-0 left-0 w-1/2 opacity-0"
            onClick={() => handleSideResponse('left')}
            aria-label="Réponse gauche"
          />
          <button
            className="absolute inset-y-0 right-0 w-1/2 opacity-0"
            onClick={() => handleSideResponse('right')}
            aria-label="Réponse droite"
          />

          {phase === 'fixation' && (
            <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-white text-5xl font-light opacity-50">
              +
            </span>
          )}

          {(phase === 'stimulus' || phase === 'feedback') && currentTrial && (
            <div
              className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 transition-none"
              style={{ left: stimulusLeft }}
            >
              <div
                className="w-24 h-24 rounded-full"
                style={{
                  backgroundColor: stimulusColor,
                  boxShadow:
                    feedbackCorrect === true
                      ? '0 0 30px #22c55e'
                      : feedbackCorrect === false
                      ? '0 0 30px #ef4444'
                      : 'none',
                }}
              />
            </div>
          )}
        </div>

        {/* Boutons de réponse desktop en bas */}
        <div className="hidden sm:flex justify-between px-8 pb-4 gap-4">
          <button
            onClick={() => handleSideResponse('left')}
            className="flex-1 min-h-16 rounded-xl bg-gray-800 hover:bg-gray-700 text-white font-semibold text-lg transition-colors active:scale-95 select-none"
          >
            ← Gauche
          </button>
          <button
            onClick={() => handleSideResponse('right')}
            className="flex-1 min-h-16 rounded-xl bg-gray-800 hover:bg-gray-700 text-white font-semibold text-lg transition-colors active:scale-95 select-none"
          >
            Droite →
          </button>
        </div>

        {/* Indication mobile */}
        <p className="sm:hidden text-center text-gray-600 text-sm pb-3">
          Tap gauche / droite pour répondre
        </p>
      </div>
    </CognitiveTestShell>
  )
}
