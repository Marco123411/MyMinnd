'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CognitiveTestShell } from './CognitiveTestShell'
import { useTrialRecorder } from '@/hooks/useTrialRecorder'
import { completeCognitiveSessionAction } from '@/app/actions/cognitive'
import { shuffle } from '@/lib/cognitive/shuffle'
import { interpolate, computeTrialCount } from '@/lib/cognitive/intensity-interpolation'
import type { StroopConfig } from '@/types'

interface StroopTestProps {
  sessionId: string
  config: StroopConfig
  durationSec?: number
  intensityPercent?: number
}

type Phase = 'fixation' | 'stimulus' | 'feedback' | 'complete'
type ColorKey = 'rouge' | 'bleu' | 'vert' | 'jaune'
type Condition = 'congruent' | 'incongruent' | 'neutral'

interface StroopTrial {
  word: string
  inkColor: ColorKey
  correctColor: ColorKey
  condition: Condition
}

// Mapping couleurs → valeurs CSS
const COLOR_MAP: Record<ColorKey, string> = {
  rouge: '#ef4444',
  bleu: '#3b82f6',
  vert: '#22c55e',
  jaune: '#FF9F40',
}

const COLOR_KEYS: ColorKey[] = ['rouge', 'bleu', 'vert', 'jaune']
const COLOR_LABELS: Record<ColorKey, string> = {
  rouge: 'Rouge',
  bleu: 'Bleu',
  vert: 'Vert',
  jaune: 'Jaune',
}
const KEY_MAP: Record<string, ColorKey> = {
  r: 'rouge', '1': 'rouge',
  b: 'bleu',  '2': 'bleu',
  v: 'vert',  '3': 'vert',
  j: 'jaune', '4': 'jaune',
}

// Génère les N trials répartis par condition avec ratio congruent variable
function generateTrials(totalCount: number, congruentRatio: number): StroopTrial[] {
  const trials: StroopTrial[] = []
  const congruentCount = Math.round(totalCount * congruentRatio)
  const incongruentCount = Math.round(totalCount * (1 - congruentRatio) * 0.6)
  const neutralCount = totalCount - congruentCount - incongruentCount

  for (let i = 0; i < congruentCount; i++) {
    const color = COLOR_KEYS[i % COLOR_KEYS.length]
    trials.push({ word: color.toUpperCase(), inkColor: color, correctColor: color, condition: 'congruent' })
  }

  for (let i = 0; i < incongruentCount; i++) {
    const inkColor = COLOR_KEYS[i % COLOR_KEYS.length]
    const otherColors = COLOR_KEYS.filter((c) => c !== inkColor)
    const word = otherColors[i % otherColors.length]
    trials.push({ word: word.toUpperCase(), inkColor, correctColor: inkColor, condition: 'incongruent' })
  }

  for (let i = 0; i < neutralCount; i++) {
    const inkColor = COLOR_KEYS[i % COLOR_KEYS.length]
    trials.push({ word: 'XXXX', inkColor, correctColor: inkColor, condition: 'neutral' })
  }

  return shuffle(trials)
}

export function StroopTest({ sessionId, config, durationSec, intensityPercent }: StroopTestProps) {
  const router = useRouter()
  const { recordTrial, flush } = useTrialRecorder(sessionId)

  // Interpolation des paramètres selon l'intensité si fournie — memoized pour stabiliser rafLoop
  const resolvedIsiMs = useMemo(
    () => intensityPercent !== undefined
      ? interpolate(intensityPercent, [2500, 1000])
      : (config.fixation_duration_ms ?? 500),
    [intensityPercent, config.fixation_duration_ms]
  )
  const resolvedCongruentRatio = useMemo(
    () => intensityPercent !== undefined
      ? interpolate(intensityPercent, [70, 30]) / 100
      : 0.5,
    [intensityPercent]
  )
  const resolvedDurationSec = useMemo(
    () => durationSec ?? (config.trials_per_condition ?? 24) * 3 * 2,
    [durationSec, config.trials_per_condition]
  )
  const maxDurationMs = useMemo(() => resolvedDurationSec * 1000, [resolvedDurationSec])

  const trials = useMemo(() => {
    if (intensityPercent !== undefined || durationSec !== undefined) {
      const count = computeTrialCount(resolvedDurationSec, resolvedIsiMs)
      return generateTrials(Math.max(count, 6), resolvedCongruentRatio)
    }
    return generateTrials((config.trials_per_condition ?? 24) * 3, 0.33)
  }, [intensityPercent, durationSec, resolvedDurationSec, resolvedIsiMs, resolvedCongruentRatio, config.trials_per_condition])

  const totalTrials = trials.length
  const testStartRef = useRef<number>(0)

  const [phase, setPhase] = useState<Phase>('fixation')
  const [currentIndex, setCurrentIndex] = useState(0)
  const [feedbackColor, setFeedbackColor] = useState<'correct' | 'incorrect' | null>(null)
  const [error, setError] = useState<string | null>(null)

  const phaseRef = useRef<Phase>('fixation')
  const currentIndexRef = useRef(0)
  const phaseStartRef = useRef(0)
  const stimulusShownAtRef = useRef(0)
  const rafIdRef = useRef(0)
  const isCompletingRef = useRef(false)
  const isRespondingRef = useRef(false)

  const fixationDuration = useMemo(() => config.fixation_duration_ms ?? 500, [config.fixation_duration_ms])
  const feedbackDuration = useMemo(() => config.feedback_duration_ms ?? 200, [config.feedback_duration_ms])
  const timeoutMs = useMemo(() => config.timeout_ms ?? 3000, [config.timeout_ms])
  const isiDuration = useMemo(
    () => durationSec !== undefined ? resolvedIsiMs : fixationDuration,
    [durationSec, resolvedIsiMs, fixationDuration]
  )

  const completeSession = useCallback(async () => {
    if (isCompletingRef.current) return
    isCompletingRef.current = true
    cancelAnimationFrame(rafIdRef.current)
    await flush()
    const { error: e } = await completeCognitiveSessionAction(sessionId)
    if (e) { setError(e); return }
    router.push(`/test/cognitive/stroop/results/${sessionId}`)
  }, [sessionId, flush, router])

  // rAF loop pour les transitions de phase sans setTimeout
  const rafLoop = useCallback(
    (timestamp: number) => {
      const phase = phaseRef.current
      const elapsed = timestamp - phaseStartRef.current

      // Arrêt par durée maximale (mode programme)
      if (durationSec !== undefined && (timestamp - testStartRef.current) >= maxDurationMs) {
        completeSession()
        return
      }

      if (phase === 'fixation') {
        if (elapsed >= isiDuration) {
          phaseRef.current = 'stimulus'
          setPhase('stimulus')
          stimulusShownAtRef.current = performance.now()
          phaseStartRef.current = timestamp
          isRespondingRef.current = false
        }
      } else if (phase === 'stimulus') {
        // Timeout — compter comme incorrect
        if (elapsed >= timeoutMs) {
          const idx = currentIndexRef.current
          recordTrial({
            trial_index: idx,
            stimulus_type: trials[idx].condition,
            stimulus_data: { word: trials[idx].word, ink_color: trials[idx].inkColor },
            response_data: null,
            reaction_time_ms: null,
            is_correct: false,
            is_anticipation: false,
            is_lapse: false,
          })
          setFeedbackColor('incorrect')
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
          setFeedbackColor(null)
          phaseRef.current = 'fixation'
          setPhase('fixation')
          phaseStartRef.current = timestamp
        }
      }

      rafIdRef.current = requestAnimationFrame(rafLoop)
    },
    [durationSec, maxDurationMs, isiDuration, timeoutMs, feedbackDuration, totalTrials, trials, recordTrial, completeSession]
  )

  useEffect(() => {
    phaseRef.current = 'fixation'
    phaseStartRef.current = performance.now()
    testStartRef.current = performance.now()
    rafIdRef.current = requestAnimationFrame(rafLoop)
    return () => cancelAnimationFrame(rafIdRef.current)
  }, [rafLoop])

  const handleColorResponse = useCallback(
    (chosen: ColorKey) => {
      if (phaseRef.current !== 'stimulus' || isRespondingRef.current) return
      isRespondingRef.current = true

      const now = performance.now()
      const rt = Math.round(now - stimulusShownAtRef.current)
      const idx = currentIndexRef.current
      const trial = trials[idx]
      const isCorrect = chosen === trial.correctColor

      recordTrial({
        trial_index: idx,
        stimulus_type: trial.condition,
        stimulus_data: { word: trial.word, ink_color: trial.inkColor },
        response_data: { chosen_color: chosen },
        reaction_time_ms: rt,
        is_correct: isCorrect,
        is_anticipation: false,
        is_lapse: false,
      })

      setFeedbackColor(isCorrect ? 'correct' : 'incorrect')
      phaseRef.current = 'feedback'
      setPhase('feedback')
      phaseStartRef.current = performance.now()
    },
    [trials, recordTrial]
  )

  // Raccourcis clavier
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase()
      if (KEY_MAP[key]) handleColorResponse(KEY_MAP[key])
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleColorResponse])

  const handleAbandon = useCallback(async () => {
    cancelAnimationFrame(rafIdRef.current)
    router.push('/client')
  }, [router])

  const currentTrial = trials[currentIndex]
  const progressValue = ((currentIndex) / totalTrials) * 100

  if (error) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-gray-950 text-white">
        <p className="text-red-400">{error}</p>
      </div>
    )
  }

  return (
    <CognitiveTestShell
      title="Stroop"
      progressValue={progressValue}
      progressLabel={`Trial ${currentIndex + 1} / ${totalTrials}`}
      onAbandon={handleAbandon}
      durationSec={durationSec}
    >
      <div className="flex flex-col items-center justify-between w-full h-full px-4 py-8">
        {/* Zone stimulus (centre) */}
        <div className="flex-1 flex items-center justify-center">
          {phase === 'fixation' && (
            <span className="text-white text-5xl font-light opacity-50">+</span>
          )}
          {(phase === 'stimulus' || phase === 'feedback') && currentTrial && (
            <span
              className="font-bold select-none leading-none"
              style={{
                fontSize: '5rem',
                color: COLOR_MAP[currentTrial.inkColor],
                // Feedback visuel : bordure verte/rouge autour du mot
                textShadow:
                  feedbackColor === 'correct'
                    ? '0 0 20px #22c55e'
                    : feedbackColor === 'incorrect'
                    ? '0 0 20px #ef4444'
                    : 'none',
              }}
            >
              {currentTrial.word}
            </span>
          )}
        </div>

        {/* Boutons de réponse en bas */}
        <div className="grid grid-cols-2 gap-3 w-full max-w-sm sm:grid-cols-4 sm:max-w-2xl">
          {COLOR_KEYS.map((colorKey) => (
            <button
              key={colorKey}
              onClick={() => handleColorResponse(colorKey)}
              className="min-h-16 rounded-xl font-bold text-white text-lg transition-transform active:scale-95 select-none"
              style={{ backgroundColor: COLOR_MAP[colorKey] }}
              aria-label={COLOR_LABELS[colorKey]}
            >
              {COLOR_LABELS[colorKey]}
            </button>
          ))}
        </div>
      </div>
    </CognitiveTestShell>
  )
}
