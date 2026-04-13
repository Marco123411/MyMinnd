'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useTrialRecorder } from '@/hooks/useTrialRecorder'
import { interpolate, computeTrialCount } from '@/lib/cognitive/intensity-interpolation'
import { TestTimer } from '@/components/cognitive/TestTimer'

interface DrillProps {
  sessionId: string
  durationSec: number
  intensityPercent: number
  onComplete: () => void
}

type TrialPhase = 'fixation' | 'stimulus' | 'feedback'
type Direction = 'left' | 'right'
type Congruency = 'congruent' | 'incongruent'

interface FlankerTrial {
  targetDirection: Direction
  congruency: Congruency
  display: string
}

function generateFlankerTrial(congruentRatio: number): FlankerTrial {
  const targetDirection: Direction = Math.random() < 0.5 ? 'left' : 'right'
  const isCongruent = Math.random() < congruentRatio
  const congruency: Congruency = isCongruent ? 'congruent' : 'incongruent'

  let display: string
  if (targetDirection === 'right') {
    display = isCongruent ? '> > > > >' : '< < > < <'
  } else {
    display = isCongruent ? '< < < < <' : '> > < > >'
  }

  return { targetDirection, congruency, display }
}

export function FlankerTest({ sessionId, durationSec, intensityPercent, onComplete }: DrillProps) {
  const { recordTrial, flush } = useTrialRecorder(sessionId)
  const flushRef = useRef(flush)
  flushRef.current = flush

  const congruentRatio = interpolate(intensityPercent, [70, 30]) / 100
  const isiMs = interpolate(intensityPercent, [2000, 800])
  const totalTrials = computeTrialCount(durationSec, isiMs)

  const [phase, setPhase] = useState<TrialPhase>('fixation')
  const [currentTrial, setCurrentTrial] = useState<FlankerTrial>(() =>
    generateFlankerTrial(congruentRatio)
  )
  const [feedbackCorrect, setFeedbackCorrect] = useState<boolean | null>(null)
  const [trialIndex, setTrialIndex] = useState(0)

  const phaseRef = useRef<TrialPhase>('fixation')
  const currentTrialRef = useRef<FlankerTrial>(currentTrial)
  const phaseStartRef = useRef(0)
  const testStartRef = useRef(0)
  const stimulusShownAtRef = useRef(0)
  const rafIdRef = useRef(0)
  const trialIndexRef = useRef(0)
  const respondedRef = useRef(false)
  const isCompletingRef = useRef(false)
  const onCompleteRef = useRef(onComplete)
  onCompleteRef.current = onComplete

  const completeTest = useCallback(() => {
    if (isCompletingRef.current) return
    isCompletingRef.current = true
    cancelAnimationFrame(rafIdRef.current)
    flushRef.current().then(() => onCompleteRef.current())
  }, [])

  const handleDirectionResponse = useCallback(
    (direction: Direction) => {
      if (phaseRef.current !== 'stimulus' || respondedRef.current) return
      respondedRef.current = true

      const rt = Math.round(performance.now() - stimulusShownAtRef.current)
      const trial = currentTrialRef.current
      const isCorrect = direction === trial.targetDirection

      recordTrial({
        trial_index: trialIndexRef.current,
        stimulus_type: trial.congruency,
        stimulus_data: { display: trial.display, target_direction: trial.targetDirection, congruency: trial.congruency },
        response_data: { direction },
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
    [recordTrial]
  )

  const rafLoop = useCallback(
    (timestamp: number) => {
      if (isCompletingRef.current) return

      const elapsed = timestamp - phaseStartRef.current
      const totalElapsed = timestamp - testStartRef.current

      if (totalElapsed >= durationSec * 1000 || trialIndexRef.current >= totalTrials) {
        completeTest()
        return
      }

      const phase = phaseRef.current

      if (phase === 'fixation') {
        if (elapsed >= 500) {
          const trial = generateFlankerTrial(congruentRatio)
          currentTrialRef.current = trial
          setCurrentTrial(trial)
          respondedRef.current = false
          stimulusShownAtRef.current = performance.now()
          phaseRef.current = 'stimulus'
          setPhase('stimulus')
          setFeedbackCorrect(null)
          phaseStartRef.current = timestamp
        }
      } else if (phase === 'stimulus') {
        if (elapsed >= 2000) {
          const trial = currentTrialRef.current
          recordTrial({
            trial_index: trialIndexRef.current,
            stimulus_type: trial.congruency,
            stimulus_data: { display: trial.display, target_direction: trial.targetDirection, congruency: trial.congruency },
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
        if (elapsed >= 300 + isiMs) {
          trialIndexRef.current += 1
          setTrialIndex(trialIndexRef.current)
          setFeedbackCorrect(null)
          phaseRef.current = 'fixation'
          setPhase('fixation')
          phaseStartRef.current = timestamp
        }
      }

      rafIdRef.current = requestAnimationFrame(rafLoop)
    },
    [durationSec, totalTrials, congruentRatio, isiMs, recordTrial, completeTest]
  )

  useEffect(() => {
    testStartRef.current = performance.now()
    phaseStartRef.current = performance.now()
    rafIdRef.current = requestAnimationFrame(rafLoop)
    return () => cancelAnimationFrame(rafIdRef.current)
  }, [rafLoop])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') handleDirectionResponse('left')
      if (e.key === 'ArrowRight') handleDirectionResponse('right')
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleDirectionResponse])

  return (
    <div
      className="fixed inset-0 flex flex-col items-center select-none"
      style={{ backgroundColor: '#1A1A2E' }}
    >
      <TestTimer durationSec={durationSec} onExpire={completeTest} />

      {/* Stimulus zone */}
      <div className="flex-1 flex items-center justify-center">
        {phase === 'fixation' && (
          <span className="text-white text-5xl font-light opacity-50">+</span>
        )}
        {(phase === 'stimulus' || phase === 'feedback') && (
          <span
            className="font-bold tracking-widest"
            style={{
              fontSize: '3rem',
              color:
                feedbackCorrect === true ? '#22c55e'
                : feedbackCorrect === false ? '#ef4444'
                : '#ffffff',
            }}
          >
            {currentTrial.display}
          </span>
        )}
      </div>

      {/* Response buttons */}
      <div className="flex gap-4 pb-8 w-full max-w-md px-4">
        <button
          onClick={() => handleDirectionResponse('left')}
          className="flex-1 min-h-16 rounded-xl bg-gray-800 hover:bg-gray-700 text-white text-xl font-bold active:scale-95 transition-transform"
        >
          ← Gauche
        </button>
        <button
          onClick={() => handleDirectionResponse('right')}
          className="flex-1 min-h-16 rounded-xl bg-gray-800 hover:bg-gray-700 text-white text-xl font-bold active:scale-95 transition-transform"
        >
          Droite →
        </button>
      </div>
    </div>
  )
}
