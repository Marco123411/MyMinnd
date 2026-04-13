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

type Phase = 'displaying' | 'responding' | 'feedback'

function generateSequence(length: number, gridSize: number): number[] {
  const totalCells = gridSize * gridSize
  const seq: number[] = []
  for (let i = 0; i < length; i++) {
    let cell: number
    do {
      cell = Math.floor(Math.random() * totalCells)
    } while (seq.length > 0 && cell === seq[seq.length - 1])
    seq.push(cell)
  }
  return seq
}

export function SpatialSpan({ sessionId, durationSec, intensityPercent, onComplete }: DrillProps) {
  const { recordTrial, flush } = useTrialRecorder(sessionId)
  const flushRef = useRef(flush)
  flushRef.current = flush

  const gridSize = intensityPercent < 55 ? 3 : 4
  const totalCells = gridSize * gridSize
  const startLength = interpolate(intensityPercent, [2, 4])
  const displayMs = interpolate(intensityPercent, [800, 400])

  const [phase, setPhase] = useState<Phase>('displaying')
  const [sequence, setSequence] = useState<number[]>(() => generateSequence(startLength, gridSize))
  const [highlightedCell, setHighlightedCell] = useState<number | null>(null)
  const [currentSpan, setCurrentSpan] = useState(startLength)
  const [userTaps, setUserTaps] = useState<number[]>([])
  const [feedbackCorrect, setFeedbackCorrect] = useState<boolean | null>(null)
  const [trialIndex, setTrialIndex] = useState(0)
  const [consecutiveFails, setConsecutiveFails] = useState(0)

  const phaseRef = useRef<Phase>('displaying')
  const sequenceRef = useRef(sequence)
  const currentSpanRef = useRef(startLength)
  const trialIndexRef = useRef(0)
  const consecutiveFailsRef = useRef(0)
  const testStartRef = useRef(0)
  const displayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isCompletingRef = useRef(false)
  const onCompleteRef = useRef(onComplete)
  onCompleteRef.current = onComplete

  const completeTest = useCallback(() => {
    if (isCompletingRef.current) return
    isCompletingRef.current = true
    if (displayTimerRef.current) clearTimeout(displayTimerRef.current)
    flushRef.current().then(() => onCompleteRef.current())
  }, [])

  const startDisplaying = useCallback(
    (seq: number[]) => {
      sequenceRef.current = seq
      setSequence(seq)
      setUserTaps([])
      setFeedbackCorrect(null)

      let idx = 0
      const showNext = () => {
        if (isCompletingRef.current) return
        if (idx >= seq.length) {
          setHighlightedCell(null)
          displayTimerRef.current = setTimeout(() => {
            if (!isCompletingRef.current) {
              phaseRef.current = 'responding'
              setPhase('responding')
            }
          }, 500)
          return
        }
        setHighlightedCell(seq[idx])
        idx++
        displayTimerRef.current = setTimeout(() => {
          setHighlightedCell(null)
          displayTimerRef.current = setTimeout(showNext, 100)
        }, displayMs)
      }
      phaseRef.current = 'displaying'
      setPhase('displaying')
      showNext()
    },
    [displayMs]
  )

  const handleCellTap = useCallback(
    (cellIndex: number) => {
      if (phaseRef.current !== 'responding') return

      setUserTaps((prev) => {
        if (prev.includes(cellIndex)) return prev // rejeter les doublons
        const newTaps = [...prev, cellIndex]

        if (newTaps.length === sequenceRef.current.length) {
          // Validate
          const seq = sequenceRef.current
          const isCorrect = newTaps.every((t, i) => t === seq[i])
          const span = currentSpanRef.current

          recordTrial({
            trial_index: trialIndexRef.current,
            stimulus_type: 'spatial_span',
            stimulus_data: { sequence: seq, length: span },
            response_data: { response_sequence: newTaps },
            reaction_time_ms: null,
            is_correct: isCorrect,
            is_anticipation: false,
            is_lapse: false,
          })
          trialIndexRef.current += 1
          setTrialIndex(trialIndexRef.current)
          setFeedbackCorrect(isCorrect)
          phaseRef.current = 'feedback'
          setPhase('feedback')

          displayTimerRef.current = setTimeout(() => {
            if (isCompletingRef.current) return

            // Check total elapsed
            if (durationSec > 0 && (performance.now() - testStartRef.current) >= durationSec * 1000) {
              completeTest()
              return
            }

            if (isCorrect) {
              consecutiveFailsRef.current = 0
              setConsecutiveFails(0)
              const nextSpan = span + 1
              currentSpanRef.current = nextSpan
              setCurrentSpan(nextSpan)
              startDisplaying(generateSequence(nextSpan, gridSize))
            } else {
              const newFails = consecutiveFailsRef.current + 1
              consecutiveFailsRef.current = newFails
              setConsecutiveFails(newFails)
              if (newFails >= 2) {
                completeTest()
              } else {
                startDisplaying(generateSequence(span, gridSize))
              }
            }
          }, 1500)
        }

        return newTaps
      })
    },
    [recordTrial, durationSec, gridSize, startDisplaying, completeTest]
  )

  useEffect(() => {
    testStartRef.current = performance.now()
    startDisplaying(generateSequence(startLength, gridSize))
    return () => {
      if (displayTimerRef.current) clearTimeout(displayTimerRef.current)
    }
  }, [startLength, gridSize, startDisplaying])

  return (
    <div
      className="fixed inset-0 flex flex-col items-center select-none"
      style={{ backgroundColor: '#1A1A2E' }}
    >
      <TestTimer durationSec={durationSec} onExpire={completeTest} />

      <div className="flex-1 flex flex-col items-center justify-center">
      <div className="mb-4 text-center">
        <p className="text-gray-400 text-sm">
          Longueur {currentSpan} · Échecs consécutifs: {consecutiveFails}/2
        </p>
        {phase === 'displaying' && (
          <p className="text-gray-600 text-xs mt-1">Mémorise la séquence…</p>
        )}
        {phase === 'responding' && (
          <p className="text-[#20808D] text-sm mt-1">Reproduis la séquence !</p>
        )}
        {feedbackCorrect !== null && (
          <p
            className="text-sm font-bold mt-1"
            style={{ color: feedbackCorrect ? '#22c55e' : '#ef4444' }}
          >
            {feedbackCorrect ? 'Correct !' : 'Incorrect'}
          </p>
        )}
      </div>

      {/* Grid */}
      <div
        className="grid gap-2"
        style={{
          gridTemplateColumns: `repeat(${gridSize}, 60px)`,
          gridTemplateRows: `repeat(${gridSize}, 60px)`,
        }}
      >
        {Array.from({ length: totalCells }, (_, i) => {
          const isHighlighted = highlightedCell === i
          const isTapped = userTaps.includes(i)
          return (
            <button
              key={i}
              onClick={() => handleCellTap(i)}
              className="rounded-lg transition-all active:scale-95"
              style={{
                width: 60,
                height: 60,
                backgroundColor: isHighlighted
                  ? '#20808D'
                  : isTapped
                  ? '#FFC55380'
                  : '#374151',
                boxShadow: isHighlighted ? '0 0 20px #20808D' : 'none',
                cursor: phase === 'responding' ? 'pointer' : 'default',
              }}
            />
          )
        })}
      </div>
      </div>
    </div>
  )
}
