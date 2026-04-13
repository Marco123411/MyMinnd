'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useTrialRecorder } from '@/hooks/useTrialRecorder'
import { interpolate } from '@/lib/cognitive/intensity-interpolation'
import { TestTimer } from '@/components/cognitive/TestTimer'

interface DrillProps {
  sessionId: string
  durationSec: number
  intensityPercent: number
  onComplete: () => void
}

type ResponseType = 'hit' | 'miss' | 'false_alarm' | 'correct_rejection'

const POSITIONS = 24
const RADIUS = 120
const CENTER = 150

function getPosition(index: number): { x: number; y: number } {
  const angle = (index / POSITIONS) * 2 * Math.PI - Math.PI / 2
  return {
    x: CENTER + RADIUS * Math.cos(angle),
    y: CENTER + RADIUS * Math.sin(angle),
  }
}

export function MackworthClock({ sessionId, durationSec, intensityPercent, onComplete }: DrillProps) {
  const { recordTrial, flush } = useTrialRecorder(sessionId)
  const flushRef = useRef(flush)
  flushRef.current = flush

  const doubleJumpFreq = interpolate(intensityPercent, [8, 15]) / 100
  const tickIntervalMs = interpolate(intensityPercent, [1500, 800])

  const [activePosition, setActivePosition] = useState(0)
  const [trialIndex, setTrialIndex] = useState(0)

  const activePositionRef = useRef(0)
  const testStartRef = useRef(0)
  const lastTickRef = useRef(0)
  const trialIndexRef = useRef(0)
  const isTargetRef = useRef(false)
  const respondedRef = useRef(false)
  const lastResponseTimeRef = useRef(0)
  const tickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isCompletingRef = useRef(false)
  const onCompleteRef = useRef(onComplete)
  onCompleteRef.current = onComplete

  const completeTest = useCallback(() => {
    if (isCompletingRef.current) return
    isCompletingRef.current = true
    if (tickTimerRef.current) clearTimeout(tickTimerRef.current)
    flushRef.current().then(() => onCompleteRef.current())
  }, [])

  const tick = useCallback(() => {
    if (isCompletingRef.current) return

    const now = performance.now()
    const totalElapsed = now - testStartRef.current

    // Enregistrer le tick précédent si pas de réponse
    const idx = trialIndexRef.current
    const wasTarget = isTargetRef.current
    const responded = respondedRef.current

    if (totalElapsed >= durationSec * 1000) {
      // Enregistrer le dernier trial en attente avant de terminer
      if (idx > 0 && !responded) {
        const response: ResponseType = wasTarget ? 'miss' : 'correct_rejection'
        recordTrial({
          trial_index: idx,
          stimulus_type: wasTarget ? 'target' : 'standard',
          stimulus_data: { position: activePositionRef.current, is_target: wasTarget },
          response_data: { response, rt: null },
          reaction_time_ms: null,
          is_correct: !wasTarget,
          is_anticipation: false,
          is_lapse: wasTarget,
        })
      }
      completeTest()
      return
    }

    if (idx > 0 && !responded) {
      const response: ResponseType = wasTarget ? 'miss' : 'correct_rejection'
      recordTrial({
        trial_index: idx,
        stimulus_type: wasTarget ? 'target' : 'standard',
        stimulus_data: { position: activePositionRef.current, is_target: wasTarget },
        response_data: { response, rt: null },
        reaction_time_ms: null,
        is_correct: !wasTarget, // correct_rejection est correct, miss est incorrect
        is_anticipation: false,
        is_lapse: wasTarget,
      })
    }

    // Avancer la position
    const isDouble = Math.random() < doubleJumpFreq
    const advance = isDouble ? 2 : 1
    const newPosition = (activePositionRef.current + advance) % POSITIONS
    activePositionRef.current = newPosition
    isTargetRef.current = isDouble
    respondedRef.current = false
    lastTickRef.current = now
    trialIndexRef.current += 1

    setActivePosition(newPosition)
    setTrialIndex(trialIndexRef.current)

    tickTimerRef.current = setTimeout(tick, tickIntervalMs)
  }, [durationSec, doubleJumpFreq, tickIntervalMs, recordTrial, completeTest])

  const handleResponse = useCallback(() => {
    if (respondedRef.current) return
    respondedRef.current = true

    const rt = Math.round(performance.now() - lastTickRef.current)
    const isTarget = isTargetRef.current
    const response: ResponseType = isTarget ? 'hit' : 'false_alarm'
    lastResponseTimeRef.current = performance.now()

    recordTrial({
      trial_index: trialIndexRef.current,
      stimulus_type: isTarget ? 'target' : 'standard',
      stimulus_data: { position: activePositionRef.current, is_target: isTarget },
      response_data: { response, rt },
      reaction_time_ms: rt,
      is_correct: isTarget,
      is_anticipation: false,
      is_lapse: false,
    })
  }, [recordTrial])

  useEffect(() => {
    testStartRef.current = performance.now()
    lastTickRef.current = performance.now()
    tickTimerRef.current = setTimeout(tick, tickIntervalMs)
    return () => {
      if (tickTimerRef.current) clearTimeout(tickTimerRef.current)
    }
  }, [tick, tickIntervalMs])

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

  return (
    <div
      className="fixed inset-0 flex flex-col items-center select-none"
      style={{ backgroundColor: '#1A1A2E' }}
      onClick={handleResponse}
    >
      <TestTimer durationSec={durationSec} onExpire={completeTest} />

      <div className="flex-1 flex flex-col items-center justify-center">
        {/* SVG Clock */}
        <svg width={300} height={300} viewBox="0 0 300 300">
          {/* Clock circle */}
          <circle cx={CENTER} cy={CENTER} r={RADIUS + 15} fill="none" stroke="#374151" strokeWidth={2} />

          {/* Position dots */}
          {Array.from({ length: POSITIONS }, (_, i) => {
            const pos = getPosition(i)
            const isActive = i === activePosition
            return (
              <circle
                key={i}
                cx={pos.x}
                cy={pos.y}
                r={isActive ? 10 : 5}
                fill={isActive ? '#20808D' : '#374151'}
                style={{
                  filter: isActive ? 'drop-shadow(0 0 8px #20808D)' : 'none',
                  transition: 'r 0.1s, fill 0.1s',
                }}
              />
            )
          })}

          {/* Center dot */}
          <circle cx={CENTER} cy={CENTER} r={4} fill="#6B7280" />
        </svg>

        {/* Instruction + trial counter */}
        <div className="mt-6 text-center">
          <p className="text-gray-400 text-sm mb-1">Trial {trialIndex}</p>
          <p className="text-gray-600 text-xs">Tape quand le point saute 2 positions d&apos;un coup</p>
          <p className="text-gray-700 text-xs mt-1">Tap / Espace</p>
        </div>
      </div>
    </div>
  )
}
