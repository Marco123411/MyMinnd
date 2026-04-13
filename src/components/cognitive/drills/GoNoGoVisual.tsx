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
type StimulusType = 'go' | 'nogo'
type ResponseType = 'hit' | 'miss' | 'false_alarm' | 'correct_rejection'

export function GoNoGoVisual({ sessionId, durationSec, intensityPercent, onComplete }: DrillProps) {
  const { recordTrial, flush } = useTrialRecorder(sessionId)
  const flushRef = useRef(flush)
  flushRef.current = flush

  const noGoRatio = interpolate(intensityPercent, [20, 45]) / 100
  const isiMs = interpolate(intensityPercent, [2000, 800])
  const totalTrials = computeTrialCount(durationSec, isiMs)

  const [phase, setPhase] = useState<TrialPhase>('fixation')
  const [stimulusType, setStimulusType] = useState<StimulusType>('go')
  const [feedbackColor, setFeedbackColor] = useState<string | null>(null)
  const [trialIndex, setTrialIndex] = useState(0)

  const phaseRef = useRef<TrialPhase>('fixation')
  const stimulusTypeRef = useRef<StimulusType>('go')
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

  const handleResponse = useCallback(() => {
    if (phaseRef.current !== 'stimulus' || respondedRef.current) return
    respondedRef.current = true

    const rt = Math.round(performance.now() - stimulusShownAtRef.current)
    const idx = trialIndexRef.current
    const stimType = stimulusTypeRef.current
    const response: ResponseType = stimType === 'go' ? 'hit' : 'false_alarm'

    recordTrial({
      trial_index: idx,
      stimulus_type: stimType,
      stimulus_data: { stimulus_type: stimType },
      response_data: { response, rt },
      reaction_time_ms: rt,
      is_correct: stimType === 'go',
      is_anticipation: false,
      is_lapse: false,
    })

    setFeedbackColor(stimType === 'go' ? '#22c55e' : '#ef4444')
    phaseRef.current = 'feedback'
    setPhase('feedback')
    phaseStartRef.current = performance.now()
  }, [recordTrial])

  const rafLoop = useCallback(
    (timestamp: number) => {
      if (isCompletingRef.current) return

      const elapsed = timestamp - phaseStartRef.current
      const totalElapsed = timestamp - testStartRef.current

      // Arrêt par durée
      if (totalElapsed >= durationSec * 1000 || trialIndexRef.current >= totalTrials) {
        completeTest()
        return
      }

      const phase = phaseRef.current

      if (phase === 'fixation') {
        if (elapsed >= 500) {
          // Choisir le type de stimulus
          const isNoGo = Math.random() < noGoRatio
          const stType: StimulusType = isNoGo ? 'nogo' : 'go'
          stimulusTypeRef.current = stType
          setStimulusType(stType)
          respondedRef.current = false
          stimulusShownAtRef.current = performance.now()
          phaseRef.current = 'stimulus'
          setPhase('stimulus')
          setFeedbackColor(null)
          phaseStartRef.current = timestamp
        }
      } else if (phase === 'stimulus') {
        // Timeout à 1500ms
        if (elapsed >= 1500) {
          const idx = trialIndexRef.current
          const stimType = stimulusTypeRef.current
          const response: ResponseType = stimType === 'go' ? 'miss' : 'correct_rejection'
          recordTrial({
            trial_index: idx,
            stimulus_type: stimType,
            stimulus_data: { stimulus_type: stimType },
            response_data: { response, rt: null },
            reaction_time_ms: null,
            is_correct: stimType === 'nogo',
            is_anticipation: false,
            is_lapse: stimType === 'go',
          })
          setFeedbackColor(stimType === 'nogo' ? '#22c55e' : '#ef4444')
          phaseRef.current = 'feedback'
          setPhase('feedback')
          phaseStartRef.current = timestamp
        }
      } else if (phase === 'feedback') {
        if (elapsed >= 300) {
          // ISI
          if (elapsed >= 300 + isiMs) {
            trialIndexRef.current += 1
            setTrialIndex(trialIndexRef.current)
            setFeedbackColor(null)
            phaseRef.current = 'fixation'
            setPhase('fixation')
            phaseStartRef.current = timestamp
          }
        }
      }

      rafIdRef.current = requestAnimationFrame(rafLoop)
    },
    [durationSec, totalTrials, noGoRatio, isiMs, recordTrial, completeTest]
  )

  useEffect(() => {
    testStartRef.current = performance.now()
    phaseStartRef.current = performance.now()
    rafIdRef.current = requestAnimationFrame(rafLoop)
    return () => cancelAnimationFrame(rafIdRef.current)
  }, [rafLoop])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault()
        handleResponse()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleResponse])

  const circleColor = stimulusType === 'go' ? '#4CAF50' : '#F44336'

  return (
    <div
      className="fixed inset-0 flex flex-col items-center select-none"
      style={{ backgroundColor: '#1A1A2E' }}
      onClick={handleResponse}
    >
      <TestTimer durationSec={durationSec} onExpire={completeTest} />

      {/* Fixation / stimulus zone */}
      <div className="flex-1 flex items-center justify-center">
        {phase === 'fixation' && (
          <span className="text-white text-5xl font-light opacity-50">+</span>
        )}
        {(phase === 'stimulus' || phase === 'feedback') && (
          <div
            className="rounded-full transition-none"
            style={{
              width: 120,
              height: 120,
              backgroundColor: circleColor,
              boxShadow: feedbackColor
                ? `0 0 40px ${feedbackColor}80`
                : `0 0 20px ${circleColor}60`,
            }}
          />
        )}
      </div>

      {/* Instructions */}
      <div className="pb-8 text-center">
        <p className="text-gray-500 text-sm">Tap / Espace si cercle vert — ne pas répondre si rouge</p>
      </div>
    </div>
  )
}
