'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useTrialRecorder } from '@/hooks/useTrialRecorder'
import { TestTimer } from '@/components/cognitive/TestTimer'

interface DrillProps {
  sessionId: string
  durationSec: number
  intensityPercent: number
  onComplete: () => void
}

type TrialPhase = 'fixation' | 'go' | 'complete'
type Direction = 'left' | 'right'
type TrialResponse = 'go' | 'stopped' | 'timeout'

export function StopSignalTask({ sessionId, durationSec, intensityPercent: _intensityPercent, onComplete }: DrillProps) {
  const { recordTrial, flush } = useTrialRecorder(sessionId)
  const flushRef = useRef(flush)
  flushRef.current = flush

  const STOP_RATIO = 0.25
  const GO_TIMEOUT_MS = 1500
  const FIXATION_MS = 500

  // SSD staircase state
  const ssdRef = useRef(250)
  const [phase, setPhase] = useState<TrialPhase>('fixation')
  const [direction, setDirection] = useState<Direction>('right')
  const [isStopTrial, setIsStopTrial] = useState(false)
  const [trialIndex, setTrialIndex] = useState(0)

  const phaseRef = useRef<TrialPhase>('fixation')
  const directionRef = useRef<Direction>('right')
  const isStopTrialRef = useRef(false)
  const phaseStartRef = useRef(0)
  const stimulusShownAtRef = useRef(0)
  const testStartRef = useRef(0)
  const rafIdRef = useRef(0)
  const trialIndexRef = useRef(0)
  const respondedRef = useRef(false)
  const stopBeepFiredRef = useRef(false)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const isCompletingRef = useRef(false)
  const onCompleteRef = useRef(onComplete)
  onCompleteRef.current = onComplete

  const playBeep = useCallback(() => {
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new AudioContext()
      }
      const ctx = audioCtxRef.current
      const osc = ctx.createOscillator()
      osc.frequency.value = 1000
      osc.connect(ctx.destination)
      osc.start()
      osc.stop(ctx.currentTime + 0.2)
    } catch {
      // Web Audio API non disponible — silencieux
    }
  }, [])

  const completeTest = useCallback(() => {
    if (isCompletingRef.current) return
    isCompletingRef.current = true
    cancelAnimationFrame(rafIdRef.current)
    flushRef.current().then(() => onCompleteRef.current())
  }, [])

  const startNextTrial = useCallback(() => {
    const newDirection: Direction = Math.random() < 0.5 ? 'left' : 'right'
    const newIsStop = Math.random() < STOP_RATIO
    directionRef.current = newDirection
    isStopTrialRef.current = newIsStop
    setDirection(newDirection)
    setIsStopTrial(newIsStop)
    respondedRef.current = false
    stopBeepFiredRef.current = false
    phaseRef.current = 'fixation'
    setPhase('fixation')
    phaseStartRef.current = performance.now()
  }, [])

  const handleResponse = useCallback(
    (responseDirection: Direction) => {
      if (phaseRef.current !== 'go' || respondedRef.current) return
      respondedRef.current = true

      const rt = Math.round(performance.now() - stimulusShownAtRef.current)
      const isStop = isStopTrialRef.current
      const dir = directionRef.current
      const isCorrect = responseDirection === dir
      const stopSuccess = false
      const response: TrialResponse = 'go'

      // SSD staircase: failed to stop → decrease SSD (easier next time)
      if (isStop) {
        ssdRef.current = Math.max(ssdRef.current - 50, 50)
      }

      recordTrial({
        trial_index: trialIndexRef.current,
        stimulus_type: isStop ? 'stop' : 'go',
        stimulus_data: { direction: dir, is_stop_trial: isStop, ssd_ms: ssdRef.current },
        response_data: { response, direction: responseDirection, stop_success: stopSuccess },
        reaction_time_ms: rt,
        is_correct: isCorrect && !isStop,
        is_anticipation: false,
        is_lapse: false,
      })

      trialIndexRef.current += 1
      setTrialIndex(trialIndexRef.current)

      setTimeout(() => {
        if (!isCompletingRef.current) startNextTrial()
      }, 300)
    },
    [recordTrial, startNextTrial]
  )

  const rafLoop = useCallback(
    (timestamp: number) => {
      if (isCompletingRef.current) return

      const totalElapsed = timestamp - testStartRef.current
      if (totalElapsed >= durationSec * 1000) {
        completeTest()
        return
      }

      const phase = phaseRef.current
      const elapsed = timestamp - phaseStartRef.current

      if (phase === 'fixation') {
        if (elapsed >= FIXATION_MS) {
          stimulusShownAtRef.current = performance.now()
          phaseRef.current = 'go'
          setPhase('go')
          phaseStartRef.current = timestamp
        }
      } else if (phase === 'go') {
        // Fire stop beep if this is a stop trial and SSD elapsed
        if (isStopTrialRef.current && !stopBeepFiredRef.current && elapsed >= ssdRef.current) {
          stopBeepFiredRef.current = true
          playBeep()
        }

        // Timeout
        if (elapsed >= GO_TIMEOUT_MS) {
          if (!respondedRef.current) {
            respondedRef.current = true
            const isStop = isStopTrialRef.current
            const dir = directionRef.current
            const stopSuccess = isStop
            const response: TrialResponse = isStop ? 'stopped' : 'timeout'

            // SSD staircase: stopped successfully → increase SSD (harder next time)
            if (isStop) {
              ssdRef.current = Math.min(ssdRef.current + 50, 700)
            }

            recordTrial({
              trial_index: trialIndexRef.current,
              stimulus_type: isStop ? 'stop' : 'go',
              stimulus_data: { direction: dir, is_stop_trial: isStop, ssd_ms: ssdRef.current },
              response_data: { response, stop_success: stopSuccess },
              reaction_time_ms: null,
              is_correct: isStop ? stopSuccess : false,
              is_anticipation: false,
              is_lapse: !isStop,
            })

            trialIndexRef.current += 1
            setTrialIndex(trialIndexRef.current)

            setTimeout(() => {
              if (!isCompletingRef.current) startNextTrial()
            }, 300)
          }
        }
      }

      rafIdRef.current = requestAnimationFrame(rafLoop)
    },
    [durationSec, playBeep, recordTrial, startNextTrial, completeTest]
  )

  useEffect(() => {
    testStartRef.current = performance.now()
    startNextTrial()
    rafIdRef.current = requestAnimationFrame(rafLoop)
    return () => cancelAnimationFrame(rafIdRef.current)
  }, [startNextTrial, rafLoop])

  // Fermer l'AudioContext à la destruction du composant
  useEffect(() => {
    return () => {
      if (audioCtxRef.current) {
        audioCtxRef.current.close()
        audioCtxRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') handleResponse('left')
      if (e.key === 'ArrowRight') handleResponse('right')
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleResponse])

  return (
    <div
      className="fixed inset-0 flex flex-col items-center select-none"
      style={{ backgroundColor: '#1A1A2E' }}
    >
      <TestTimer durationSec={durationSec} onExpire={completeTest} />

      <div className="flex justify-end w-full px-4 flex-shrink-0">
        <p className="text-gray-600 text-xs">Trial {trialIndex}</p>
      </div>

      {/* Stimulus zone */}
      <div className="flex-1 flex items-center justify-center">
        {phase === 'fixation' && (
          <span className="text-white text-5xl font-light opacity-50">+</span>
        )}
        {phase === 'go' && (
          <span className="text-white font-bold" style={{ fontSize: '5rem' }}>
            {direction === 'left' ? '←' : '→'}
          </span>
        )}
      </div>

      {/* Response buttons */}
      <div className="flex gap-4 pb-8 w-full max-w-md px-4">
        <button
          onClick={() => handleResponse('left')}
          className="flex-1 min-h-16 rounded-xl bg-gray-800 hover:bg-gray-700 text-white text-xl font-bold active:scale-95 transition-transform"
        >
          ← Gauche
        </button>
        <button
          onClick={() => handleResponse('right')}
          className="flex-1 min-h-16 rounded-xl bg-gray-800 hover:bg-gray-700 text-white text-xl font-bold active:scale-95 transition-transform"
        >
          Droite →
        </button>
      </div>

      <p className="pb-4 text-gray-600 text-xs text-center">Arrête-toi si tu entends le bip</p>
    </div>
  )
}
