'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CognitiveTestShell } from './CognitiveTestShell'
import { useTrialRecorder } from '@/hooks/useTrialRecorder'
import { completeCognitiveSessionAction } from '@/app/actions/cognitive'
import type { DigitalSpanConfig } from '@/types'

interface DigitalSpanTestProps {
  sessionId: string
  config: DigitalSpanConfig
}

type Phase = 'intro' | 'displaying' | 'responding' | 'feedback' | 'complete'
type Mode = 'forward' | 'backward'

// Génère une séquence aléatoire sans chiffres consécutifs identiques
function generateSequence(length: number): number[] {
  const seq: number[] = []
  for (let i = 0; i < length; i++) {
    let digit: number
    do {
      digit = Math.floor(Math.random() * 10)
    } while (seq.length > 0 && digit === seq[seq.length - 1])
    seq.push(digit)
  }
  return seq
}

export function DigitalSpanTest({ sessionId, config }: DigitalSpanTestProps) {
  const router = useRouter()
  const { recordTrial, flush } = useTrialRecorder(sessionId)

  const minSpan = config.min_span ?? 3
  const maxSpan = config.max_span ?? 12
  const digitDisplayMs = config.digit_display_ms ?? 1000
  const interDigitMs = config.inter_digit_ms ?? 300

  const [phase, setPhase] = useState<Phase>('intro')
  const [mode, setMode] = useState<Mode>('forward')
  const [currentSpan, setCurrentSpan] = useState(minSpan)
  const [attempt, setAttempt] = useState(1)
  const [sequence, setSequence] = useState<number[]>([])
  const [userInput, setUserInput] = useState<number[]>([])
  const [displayedDigit, setDisplayedDigit] = useState<number | null>(null)
  const [digitPosition, setDigitPosition] = useState(0)
  const [feedbackCorrect, setFeedbackCorrect] = useState<boolean | null>(null)
  const [trialIndex, setTrialIndex] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const phaseRef = useRef<Phase>('intro')
  const modeRef = useRef<Mode>('forward')
  const currentSpanRef = useRef(minSpan)
  const attemptRef = useRef(1)
  const trialIndexRef = useRef(0)
  const sequenceRef = useRef<number[]>([])
  const digitPositionRef = useRef(0)
  const phaseStartRef = useRef(0)
  const rafIdRef = useRef(0)
  const feedbackTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isCompletingRef = useRef(false)
  const isShowingBlankRef = useRef(false)

  const completeSession = useCallback(async () => {
    if (isCompletingRef.current) return
    isCompletingRef.current = true
    cancelAnimationFrame(rafIdRef.current)
    await flush()
    const { error: e } = await completeCognitiveSessionAction(sessionId)
    if (e) { setError(e); return }
    router.push(`/test/cognitive/digital_span/results/${sessionId}`)
  }, [sessionId, flush, router])

  // Lance un nouveau trial avec la séquence courante
  const startDisplaying = useCallback((seq: number[]) => {
    sequenceRef.current = seq
    setSequence(seq)
    digitPositionRef.current = 0
    setDigitPosition(0)
    isShowingBlankRef.current = false
    setDisplayedDigit(seq[0])
    phaseRef.current = 'displaying'
    setPhase('displaying')
    phaseStartRef.current = performance.now()
  }, [])

  // Démarre le test avec un intro bref
  const startNewTrial = useCallback((span: number) => {
    const seq = generateSequence(span)
    setTimeout(() => startDisplaying(seq), 800)
  }, [startDisplaying])

  // boucle rAF pour l'affichage des chiffres (timing précis)
  const rafLoop = useCallback(
    (timestamp: number) => {
      if (phaseRef.current !== 'displaying') return

      const elapsed = timestamp - phaseStartRef.current
      const pos = digitPositionRef.current
      const seq = sequenceRef.current

      if (!isShowingBlankRef.current) {
        // Phase d'affichage du chiffre (digitDisplayMs)
        if (elapsed >= digitDisplayMs) {
          isShowingBlankRef.current = true
          setDisplayedDigit(null)
          phaseStartRef.current = timestamp
        }
      } else {
        // Phase de blanc entre chiffres (interDigitMs)
        if (elapsed >= interDigitMs) {
          const nextPos = pos + 1
          if (nextPos >= seq.length) {
            // Séquence terminée → phase de réponse
            phaseRef.current = 'responding'
            setPhase('responding')
            setUserInput([])
            return
          }
          digitPositionRef.current = nextPos
          setDigitPosition(nextPos)
          setDisplayedDigit(seq[nextPos])
          isShowingBlankRef.current = false
          phaseStartRef.current = timestamp
        }
      }

      rafIdRef.current = requestAnimationFrame(rafLoop)
    },
    [digitDisplayMs, interDigitMs]
  )

  // Démarrer la boucle rAF quand on est en phase 'displaying'
  useEffect(() => {
    if (phase === 'displaying') {
      rafIdRef.current = requestAnimationFrame(rafLoop)
    }
    return () => cancelAnimationFrame(rafIdRef.current)
  }, [phase, rafLoop])

  // Premier trial au montage
  useEffect(() => {
    const seq = generateSequence(minSpan)
    sequenceRef.current = seq
    setSequence(seq)
    // Petit délai pour que l'utilisateur soit prêt
    const t = setTimeout(() => startDisplaying(seq), 1500)
    return () => clearTimeout(t)
  }, [minSpan, startDisplaying])

  // Valider la réponse de l'utilisateur
  const handleValidate = useCallback(() => {
    const input = userInput
    const seq = sequenceRef.current
    const currentMode = modeRef.current

    // La réponse attendue dépend du mode
    const expected = currentMode === 'forward' ? seq : [...seq].reverse()
    const isCorrect = input.length === expected.length && input.every((d, i) => d === expected[i])

    recordTrial({
      trial_index: trialIndexRef.current,
      stimulus_type: currentMode,
      stimulus_data: { sequence: seq, length: seq.length },
      response_data: { user_sequence: input },
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

    // Après le feedback, décider de la suite
    feedbackTimeoutRef.current = setTimeout(() => {
      if (isCorrect) {
        const reachedMax = currentSpanRef.current >= maxSpan
        if (reachedMax && modeRef.current === 'backward') {
          // Span maximum atteint en mode backward → fin du test
          completeSession()
          return
        }
        if (reachedMax && modeRef.current === 'forward') {
          // Span maximum atteint en mode forward → passer en backward
          modeRef.current = 'backward'
          setMode('backward')
          currentSpanRef.current = minSpan
          setCurrentSpan(minSpan)
          attemptRef.current = 1
          setAttempt(1)
          startNewTrial(minSpan)
          return
        }
        // Succès → augmenter la longueur
        const nextSpan = currentSpanRef.current + 1
        currentSpanRef.current = nextSpan
        setCurrentSpan(nextSpan)
        attemptRef.current = 1
        setAttempt(1)
        startNewTrial(nextSpan)
      } else {
        const nextAttempt = attemptRef.current + 1
        if (nextAttempt <= 2) {
          // 2e essai à la même longueur
          attemptRef.current = nextAttempt
          setAttempt(nextAttempt)
          startNewTrial(currentSpanRef.current)
        } else {
          // 2 échecs consécutifs
          if (modeRef.current === 'forward') {
            // Passer en mode backward
            modeRef.current = 'backward'
            setMode('backward')
            currentSpanRef.current = minSpan
            setCurrentSpan(minSpan)
            attemptRef.current = 1
            setAttempt(1)
            startNewTrial(minSpan)
          } else {
            // Fin du test
            completeSession()
          }
        }
      }
    }, 1500)
  }, [userInput, recordTrial, maxSpan, minSpan, startNewTrial, completeSession])

  // Ajouter un chiffre à la saisie
  const handleDigitPress = useCallback((digit: number) => {
    setUserInput((prev) => {
      if (prev.length >= sequenceRef.current.length) return prev
      return [...prev, digit]
    })
  }, [])

  // Effacer le dernier chiffre
  const handleErase = useCallback(() => {
    setUserInput((prev) => prev.slice(0, -1))
  }, [])

  // Raccourcis clavier numériques pendant la réponse
  useEffect(() => {
    if (phase !== 'responding') return
    const handleKeyDown = (e: KeyboardEvent) => {
      const n = parseInt(e.key, 10)
      if (!isNaN(n) && n >= 0 && n <= 9) handleDigitPress(n)
      if (e.key === 'Backspace') handleErase()
      if (e.key === 'Enter' && userInput.length === sequence.length) handleValidate()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [phase, userInput, sequence.length, handleDigitPress, handleErase, handleValidate])

  const handleAbandon = useCallback(async () => {
    cancelAnimationFrame(rafIdRef.current)
    if (feedbackTimeoutRef.current) clearTimeout(feedbackTimeoutRef.current)
    router.push('/client')
  }, [router])

  const progressValue =
    maxSpan === minSpan
      ? 100
      : Math.min(((currentSpan - minSpan) / (maxSpan - minSpan)) * 100, 100)

  if (error) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-gray-950 text-white">
        <p className="text-red-400">{error}</p>
      </div>
    )
  }

  return (
    <CognitiveTestShell
      title={`Digital Span — ${mode === 'forward' ? 'Avant' : 'Arrière'}`}
      progressValue={progressValue}
      progressLabel={`Longueur ${currentSpan} · Essai ${attempt}/2`}
      onAbandon={handleAbandon}
    >
      <div className="flex flex-col items-center w-full h-full px-4">

        {/* Indicateurs */}
        <div className="flex gap-4 justify-center pt-2 pb-4">
          <span className="text-xs px-2 py-1 rounded bg-gray-800 text-gray-300">
            {mode === 'forward' ? 'Mode Avant' : 'Mode Arrière'}
          </span>
          <span className="text-xs px-2 py-1 rounded bg-gray-800 text-gray-300">
            Longueur : {currentSpan}
          </span>
        </div>

        {/* Zone d'affichage principale */}
        <div className="flex-1 flex flex-col items-center justify-center gap-6 w-full">

          {/* Phase : intro / affichage séquence */}
          {(phase === 'intro' || phase === 'displaying') && (
            <div className="flex flex-col items-center gap-4">
              {phase === 'intro' && (
                <p className="text-gray-400 text-lg">Prépare-toi…</p>
              )}
              <span
                className="font-mono font-bold text-white leading-none"
                style={{ fontSize: '7rem', minWidth: '1ch', textAlign: 'center' }}
              >
                {displayedDigit !== null ? displayedDigit : '\u00A0'}
              </span>
              {phase === 'displaying' && (
                <p className="text-gray-600 text-sm">
                  {digitPosition + 1} / {sequence.length}
                </p>
              )}
            </div>
          )}

          {/* Phase : réponse */}
          {phase === 'responding' && (
            <div className="flex flex-col items-center gap-4 w-full max-w-xs">
              <p className="text-gray-400 text-sm text-center">
                {mode === 'forward'
                  ? 'Reproduis la séquence dans le même ordre'
                  : 'Reproduis la séquence dans l\'ordre inverse'}
              </p>

              {/* Zone de saisie */}
              <div className="flex gap-2 min-h-14 items-center justify-center flex-wrap">
                {userInput.length === 0 ? (
                  <span className="text-gray-600 text-2xl">…</span>
                ) : (
                  userInput.map((d, i) => (
                    <span key={i} className="font-mono text-3xl font-bold text-white">
                      {d}
                    </span>
                  ))
                )}
              </div>

              {/* Clavier numérique 3×3 + 0 */}
              <div className="grid grid-cols-3 gap-2 w-full">
                {[7, 8, 9, 4, 5, 6, 1, 2, 3].map((d) => (
                  <button
                    key={d}
                    onClick={() => handleDigitPress(d)}
                    className="h-14 rounded-lg bg-gray-800 hover:bg-gray-700 text-white text-2xl font-mono font-semibold active:scale-95 transition-transform"
                  >
                    {d}
                  </button>
                ))}
                <button
                  onClick={handleErase}
                  className="h-14 rounded-lg bg-gray-700 hover:bg-gray-600 text-white text-sm active:scale-95 transition-transform"
                >
                  ⌫
                </button>
                <button
                  onClick={() => handleDigitPress(0)}
                  className="h-14 rounded-lg bg-gray-800 hover:bg-gray-700 text-white text-2xl font-mono font-semibold active:scale-95 transition-transform"
                >
                  0
                </button>
                <button
                  onClick={handleValidate}
                  disabled={userInput.length !== sequence.length}
                  className="h-14 rounded-lg bg-[#20808D] hover:bg-[#1a6b77] disabled:opacity-30 text-white text-sm font-semibold active:scale-95 transition-transform"
                >
                  OK ✓
                </button>
              </div>
            </div>
          )}

          {/* Phase : feedback */}
          {phase === 'feedback' && (
            <div className="flex flex-col items-center gap-3">
              <span
                className="text-3xl font-bold"
                style={{ color: feedbackCorrect ? '#22c55e' : '#ef4444' }}
              >
                {feedbackCorrect ? 'Correct !' : 'Incorrect'}
              </span>
              <p className="text-gray-400 text-sm">
                Séquence : {sequence.join(' — ')}
              </p>
              {!feedbackCorrect && (
                <p className="text-gray-500 text-sm">
                  Ta réponse : {userInput.join(' — ')}
                </p>
              )}
            </div>
          )}

          {phase === 'complete' && (
            <div className="flex flex-col items-center gap-3 text-center">
              <span className="text-2xl text-white">Test terminé</span>
              <span className="text-gray-400">Calcul des résultats en cours…</span>
            </div>
          )}
        </div>
      </div>
    </CognitiveTestShell>
  )
}
