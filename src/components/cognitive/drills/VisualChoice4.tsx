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

type StimulusId = 1 | 2 | 3 | 4
type TrialPhase = 'fixation' | 'stimulus' | 'feedback'

interface Stimulus {
  id: StimulusId
  label: string
  color: string
  shape: 'circle' | 'square' | 'triangle' | 'diamond'
}

const STIMULI: Stimulus[] = [
  { id: 1, label: '1', color: '#F44336', shape: 'circle' },
  { id: 2, label: '2', color: '#4CAF50', shape: 'square' },
  { id: 3, label: '3', color: '#2196F3', shape: 'triangle' },
  { id: 4, label: '4', color: '#FFC553', shape: 'diamond' },
]

function StimulusShape({ stimulus, size = 120 }: { stimulus: Stimulus; size?: number }) {
  const { color, shape } = stimulus
  const half = size / 2

  if (shape === 'circle') {
    return (
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={half} cy={half} r={half - 4} fill={color} />
      </svg>
    )
  }
  if (shape === 'square') {
    return (
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <rect x={4} y={4} width={size - 8} height={size - 8} fill={color} rx={8} />
      </svg>
    )
  }
  if (shape === 'triangle') {
    return (
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <polygon points={`${half},4 ${size - 4},${size - 4} 4,${size - 4}`} fill={color} />
      </svg>
    )
  }
  // Diamond
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <polygon points={`${half},4 ${size - 4},${half} ${half},${size - 4} 4,${half}`} fill={color} />
    </svg>
  )
}

export function VisualChoice4({ sessionId, durationSec, intensityPercent, onComplete }: DrillProps) {
  const { recordTrial, flush } = useTrialRecorder(sessionId)
  const flushRef = useRef(flush)
  flushRef.current = flush

  const isiMs = interpolate(intensityPercent, [2000, 700])
  const totalTrials = computeTrialCount(durationSec, isiMs)

  const [phase, setPhase] = useState<TrialPhase>('fixation')
  const [currentStimulus, setCurrentStimulus] = useState<Stimulus>(STIMULI[0])
  const [feedbackCorrect, setFeedbackCorrect] = useState<boolean | null>(null)
  const [trialIndex, setTrialIndex] = useState(0)

  const phaseRef = useRef<TrialPhase>('fixation')
  const currentStimulusRef = useRef<Stimulus>(STIMULI[0])
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

  const handleKeyPress = useCallback(
    (key: StimulusId) => {
      if (phaseRef.current !== 'stimulus' || respondedRef.current) return
      respondedRef.current = true

      const rt = Math.round(performance.now() - stimulusShownAtRef.current)
      const stim = currentStimulusRef.current
      const isCorrect = key === stim.id

      recordTrial({
        trial_index: trialIndexRef.current,
        stimulus_type: `stimulus_${stim.id}`,
        stimulus_data: { stimulus_id: stim.id, shape: stim.shape },
        response_data: { response_key: key },
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

      const totalElapsed = timestamp - testStartRef.current
      if (totalElapsed >= durationSec * 1000 || trialIndexRef.current >= totalTrials) {
        completeTest()
        return
      }

      const phase = phaseRef.current
      const elapsed = timestamp - phaseStartRef.current

      if (phase === 'fixation') {
        if (elapsed >= 300) {
          const stim = STIMULI[Math.floor(Math.random() * STIMULI.length)]
          currentStimulusRef.current = stim
          setCurrentStimulus(stim)
          respondedRef.current = false
          stimulusShownAtRef.current = performance.now()
          phaseRef.current = 'stimulus'
          setPhase('stimulus')
          setFeedbackCorrect(null)
          phaseStartRef.current = timestamp
        }
      } else if (phase === 'stimulus') {
        if (elapsed >= 3000) {
          const stim = currentStimulusRef.current
          recordTrial({
            trial_index: trialIndexRef.current,
            stimulus_type: `stimulus_${stim.id}`,
            stimulus_data: { stimulus_id: stim.id, shape: stim.shape },
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
        if (elapsed >= 200 + isiMs) {
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
    [durationSec, totalTrials, isiMs, recordTrial, completeTest]
  )

  useEffect(() => {
    testStartRef.current = performance.now()
    phaseStartRef.current = performance.now()
    rafIdRef.current = requestAnimationFrame(rafLoop)
    return () => cancelAnimationFrame(rafIdRef.current)
  }, [rafLoop])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const keyMap: Record<string, StimulusId> = { '1': 1, '2': 2, '3': 3, '4': 4 }
      const id = keyMap[e.key]
      if (id) handleKeyPress(id)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyPress])

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
          <div
            style={{
              filter: feedbackCorrect === true
                ? 'drop-shadow(0 0 20px #22c55e)'
                : feedbackCorrect === false
                ? 'drop-shadow(0 0 20px #ef4444)'
                : 'none',
            }}
          >
            <StimulusShape stimulus={currentStimulus} size={120} />
          </div>
        )}
      </div>

      {/* Response buttons */}
      <div className="flex gap-2 pb-8 w-full px-4">
        {STIMULI.map((stim) => (
          <button
            key={stim.id}
            onClick={() => handleKeyPress(stim.id)}
            className="flex-1 min-h-16 rounded-xl font-bold text-white text-lg active:scale-95 transition-transform flex flex-col items-center justify-center gap-1"
            style={{ backgroundColor: `${stim.color}33`, border: `2px solid ${stim.color}` }}
          >
            <StimulusShape stimulus={stim} size={32} />
            <span className="text-xs" style={{ color: stim.color }}>{stim.label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
