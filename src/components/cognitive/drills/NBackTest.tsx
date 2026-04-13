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

// Lettres excluant I, O, Q pour éviter confusions
const LETTERS = 'ABCDEFGHJKLMNPRSTUVWXYZ'.split('')
const N_BACK = 2
const TARGET_RATIO = 0.3

function generateLetter(history: string[]): string {
  // ~30% chance de target (même lettre qu'il y a N positions)
  if (history.length >= N_BACK && Math.random() < TARGET_RATIO) {
    return history[history.length - N_BACK]
  }
  // Non-target : lettre aléatoire différente de la target potentielle
  let letter: string
  const forbidTarget = history.length >= N_BACK ? history[history.length - N_BACK] : null
  do {
    letter = LETTERS[Math.floor(Math.random() * LETTERS.length)]
  } while (letter === forbidTarget)
  return letter
}

export function NBackTest({ sessionId, durationSec, intensityPercent, onComplete }: DrillProps) {
  const { recordTrial, flush } = useTrialRecorder(sessionId)
  const flushRef = useRef(flush)
  flushRef.current = flush

  const displayMs = interpolate(intensityPercent, [2000, 1000])
  const isiMs = interpolate(intensityPercent, [1000, 500])

  const [currentLetter, setCurrentLetter] = useState('')
  const [trialIndex, setTrialIndex] = useState(0)
  const [isVisible, setIsVisible] = useState(false)
  const [flash, setFlash] = useState<'hit' | 'false_alarm' | null>(null)

  const historyRef = useRef<string[]>([])
  const currentLetterRef = useRef('')
  const isTargetRef = useRef(false)
  const trialIndexRef = useRef(0)
  const respondedRef = useRef(false)
  const testStartRef = useRef(0)
  const letterStartRef = useRef(0)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isCompletingRef = useRef(false)
  const onCompleteRef = useRef(onComplete)
  onCompleteRef.current = onComplete

  const completeTest = useCallback(() => {
    if (isCompletingRef.current) return
    isCompletingRef.current = true
    if (timerRef.current) clearTimeout(timerRef.current)
    flushRef.current().then(() => onCompleteRef.current())
  }, [])

  const scheduleNextLetter = useCallback(() => {
    timerRef.current = setTimeout(() => {
      if (isCompletingRef.current) return

      const totalElapsed = performance.now() - testStartRef.current
      if (totalElapsed >= durationSec * 1000) {
        completeTest()
        return
      }

      // Record missed response for current letter
      if (!respondedRef.current) {
        const isTarget = isTargetRef.current
        const response: ResponseType = isTarget ? 'miss' : 'correct_rejection'
        recordTrial({
          trial_index: trialIndexRef.current,
          stimulus_type: isTarget ? 'target' : 'non_target',
          stimulus_data: { letter: currentLetterRef.current, is_target: isTarget, n: N_BACK },
          response_data: { response, rt: null },
          reaction_time_ms: null,
          is_correct: !isTarget, // correct_rejection = correct
          is_anticipation: false,
          is_lapse: isTarget,
        })
        trialIndexRef.current += 1
      }

      // Generate next letter
      const letter = generateLetter(historyRef.current)
      const isTarget = historyRef.current.length >= N_BACK &&
        historyRef.current[historyRef.current.length - N_BACK] === letter

      historyRef.current = [...historyRef.current, letter]
      currentLetterRef.current = letter
      isTargetRef.current = isTarget
      respondedRef.current = false
      letterStartRef.current = performance.now()
      setTrialIndex(trialIndexRef.current)
      setCurrentLetter(letter)
      setIsVisible(true)

      // Hide after displayMs, then ISI
      timerRef.current = setTimeout(() => {
        setIsVisible(false)
        scheduleNextLetter()
      }, displayMs)
    }, isiMs)
  }, [durationSec, displayMs, isiMs, recordTrial, completeTest])

  const handleMatch = useCallback(() => {
    if (respondedRef.current || trialIndexRef.current < N_BACK) return
    respondedRef.current = true

    const rt = Math.round(performance.now() - letterStartRef.current)
    const isTarget = isTargetRef.current
    const response: ResponseType = isTarget ? 'hit' : 'false_alarm'

    setFlash(response)
    setTimeout(() => setFlash(null), 300)

    recordTrial({
      trial_index: trialIndexRef.current,
      stimulus_type: isTarget ? 'target' : 'non_target',
      stimulus_data: { letter: currentLetterRef.current, is_target: isTarget, n: N_BACK },
      response_data: { response, rt },
      reaction_time_ms: rt,
      is_correct: isTarget,
      is_anticipation: false,
      is_lapse: false,
    })
    trialIndexRef.current += 1
    setTrialIndex(trialIndexRef.current)
  }, [recordTrial])

  useEffect(() => {
    testStartRef.current = performance.now()

    // Start with first letter immediately
    const firstLetter = LETTERS[Math.floor(Math.random() * LETTERS.length)]
    historyRef.current = [firstLetter]
    currentLetterRef.current = firstLetter
    isTargetRef.current = false
    letterStartRef.current = performance.now()
    setCurrentLetter(firstLetter)
    setIsVisible(true)
    setTrialIndex(0)

    timerRef.current = setTimeout(() => {
      setIsVisible(false)
      scheduleNextLetter()
    }, displayMs)

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [displayMs, scheduleNextLetter])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault()
        handleMatch()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleMatch])

  return (
    <div
      className="fixed inset-0 flex flex-col items-center select-none"
      style={{ backgroundColor: '#1A1A2E' }}
    >
      <TestTimer durationSec={durationSec} onExpire={completeTest} />

      <p className="text-gray-600 text-xs flex-shrink-0 py-1">2-Back · Trial {trialIndex}</p>

      {/* Letter display */}
      <div className="flex-1 flex items-center justify-center">
        <span
          className="font-bold text-white transition-opacity duration-100"
          style={{
            fontSize: '6rem',
            opacity: isVisible ? 1 : 0,
            letterSpacing: '0.05em',
          }}
        >
          {currentLetter || ' '}
        </span>
      </div>

      {/* MATCH button */}
      <div className="pb-8 w-full px-8">
        <button
          onClick={handleMatch}
          className="w-full min-h-16 rounded-xl font-bold text-white text-xl active:scale-95 transition-all duration-150"
          style={{
            backgroundColor: flash === 'hit' ? '#16a34a' : flash === 'false_alarm' ? '#944454' : '#20808D',
            transform: flash ? 'scale(0.97)' : 'scale(1)',
          }}
        >
          {flash === 'hit' ? '✓ MATCH' : flash === 'false_alarm' ? '✗ ERREUR' : 'MATCH'}
        </button>
        <p className="text-center text-gray-600 text-xs mt-2">
          Appuie quand la lettre = il y a 2 lettres · Espace
        </p>
      </div>
    </div>
  )
}
