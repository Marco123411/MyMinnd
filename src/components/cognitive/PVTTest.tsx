'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CognitiveTestShell } from './CognitiveTestShell'
import { RTDisplay } from './RTDisplay'
import { useTrialRecorder } from '@/hooks/useTrialRecorder'
import { completeCognitiveSessionAction } from '@/app/actions/cognitive'
import type { PVTConfig } from '@/types'

interface PVTTestProps {
  sessionId: string
  config: PVTConfig
}

type Phase = 'fixation' | 'stimulus' | 'feedback' | 'anticipation' | 'complete'

export function PVTTest({ sessionId, config }: PVTTestProps) {
  const router = useRouter()
  const { recordTrial, flush } = useTrialRecorder(sessionId)

  // État de la machine d'état du test
  const [phase, setPhase] = useState<Phase>('fixation')
  const [currentRt, setCurrentRt] = useState<number | null>(null)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [trialIndex, setTrialIndex] = useState(0)
  const [error, setError] = useState<string | null>(null)

  // Refs pour le timing précis (rAF + performance.now())
  const phaseRef = useRef<Phase>('fixation')
  const trialIndexRef = useRef(0)
  const sessionStartRef = useRef<number>(0)
  const phaseStartRef = useRef<number>(0)
  const isiDurationRef = useRef<number>(0)
  const stimulusShownAtRef = useRef<number>(0)
  const rafIdRef = useRef<number>(0)
  const isCompletingRef = useRef(false)
  // Ref DOM pour le compteur : mise à jour directe sans re-render React (précision RT)
  const counterDomRef = useRef<HTMLSpanElement>(null)

  // Génère un ISI aléatoire entre isi_min_ms et isi_max_ms
  const randomISI = useCallback(() => {
    return (
      config.isi_min_ms +
      Math.random() * (config.isi_max_ms - config.isi_min_ms)
    )
  }, [config.isi_min_ms, config.isi_max_ms])

  // Termine la session et redirige vers les résultats
  const completeSession = useCallback(async () => {
    if (isCompletingRef.current) return
    isCompletingRef.current = true

    phaseRef.current = 'complete'
    setPhase('complete')
    cancelAnimationFrame(rafIdRef.current)

    await flush()

    const { error: completeError } = await completeCognitiveSessionAction(sessionId)
    if (completeError) {
      setError(completeError)
      return
    }
    router.push(`/test/cognitive/pvt/results/${sessionId}`)
  }, [sessionId, flush, router])

  // Boucle rAF principale — gère les transitions de phase sans setTimeout
  const rafLoop = useCallback(
    (timestamp: number) => {
      const phase = phaseRef.current
      const elapsed = timestamp - phaseStartRef.current

      if (phase === 'fixation') {
        // Vérifier si la durée de session totale est dépassée
        const totalElapsed = timestamp - sessionStartRef.current
        setElapsedSeconds(Math.floor(totalElapsed / 1000))

        if (totalElapsed >= config.duration_seconds * 1000) {
          completeSession()
          return
        }

        // Passer au stimulus quand l'ISI est écoulé
        if (elapsed >= isiDurationRef.current) {
          phaseRef.current = 'stimulus'
          setPhase('stimulus')
          stimulusShownAtRef.current = performance.now()
          phaseStartRef.current = timestamp
        }
      } else if (phase === 'stimulus') {
        // Mise à jour directe du DOM sans passer par React (évite 60fps setState qui pollue le RT)
        if (counterDomRef.current) {
          counterDomRef.current.textContent = String(Math.round(elapsed))
        }

        // Timeout : si l'utilisateur ne répond pas dans 3000ms, enregistrer un lapse
        if (elapsed >= 3000) {
          const rt = Math.round(elapsed)
          const isLapse = rt >= config.lapse_threshold_ms

          recordTrial({
            trial_index: trialIndexRef.current,
            stimulus_type: 'visual_counter',
            stimulus_data: { isi_ms: Math.round(isiDurationRef.current) },
            response_data: null,
            reaction_time_ms: rt,
            is_correct: false,
            is_anticipation: false,
            is_lapse: isLapse,
          })

          trialIndexRef.current += 1
          setTrialIndex(trialIndexRef.current)
          setCurrentRt(rt)

          if (counterDomRef.current) counterDomRef.current.textContent = '0'
          phaseRef.current = 'feedback'
          setPhase('feedback')
          phaseStartRef.current = timestamp
        }
      } else if (phase === 'feedback') {
        // 1500ms de feedback puis retour fixation
        if (elapsed >= 1500) {
          isiDurationRef.current = randomISI()
          if (counterDomRef.current) counterDomRef.current.textContent = '0'
          phaseRef.current = 'fixation'
          setPhase('fixation')
          phaseStartRef.current = timestamp
          setCurrentRt(null)
        }
      } else if (phase === 'anticipation') {
        // 1500ms d'affichage "Trop tôt !" puis retour fixation
        if (elapsed >= 1500) {
          isiDurationRef.current = randomISI()
          phaseRef.current = 'fixation'
          setPhase('fixation')
          phaseStartRef.current = timestamp
        }
      }

      rafIdRef.current = requestAnimationFrame(rafLoop)
    },
    [config.duration_seconds, config.lapse_threshold_ms, randomISI, recordTrial, completeSession]
  )

  // Démarrage du test
  useEffect(() => {
    const now = performance.now()
    sessionStartRef.current = now
    phaseStartRef.current = now
    isiDurationRef.current = randomISI()
    phaseRef.current = 'fixation'

    rafIdRef.current = requestAnimationFrame(rafLoop)
    return () => cancelAnimationFrame(rafIdRef.current)
  }, [rafLoop, randomISI])

  // Gestion des réponses (click, tap, espace)
  const handleResponse = useCallback(() => {
    const now = performance.now()
    const currentPhase = phaseRef.current

    if (currentPhase === 'fixation') {
      // Fausse alerte — anticipation
      recordTrial({
        trial_index: trialIndexRef.current,
        stimulus_type: 'visual_counter',
        stimulus_data: { isi_ms: Math.round(isiDurationRef.current) },
        response_data: null,
        reaction_time_ms: null,
        is_correct: false,
        is_anticipation: true,
        is_lapse: false,
      })
      trialIndexRef.current += 1
      setTrialIndex(trialIndexRef.current)

      // Réinitialiser l'ISI
      isiDurationRef.current = randomISI()
      phaseRef.current = 'anticipation'
      setPhase('anticipation')
      phaseStartRef.current = performance.now()
    } else if (currentPhase === 'stimulus') {
      // Réponse valide — mesure du RT
      const rt = Math.round(now - stimulusShownAtRef.current)
      const isLapse = rt >= config.lapse_threshold_ms

      recordTrial({
        trial_index: trialIndexRef.current,
        stimulus_type: 'visual_counter',
        stimulus_data: { isi_ms: Math.round(isiDurationRef.current) },
        response_data: null,
        reaction_time_ms: rt,
        is_correct: true,
        is_anticipation: false,
        is_lapse: isLapse,
      })

      trialIndexRef.current += 1
      setTrialIndex(trialIndexRef.current)
      setCurrentRt(rt)

      phaseRef.current = 'feedback'
      setPhase('feedback')
      phaseStartRef.current = performance.now()
    }
    // Ignorer les clics pendant feedback ou anticipation
  }, [config.lapse_threshold_ms, randomISI, recordTrial])

  // Écoute espace + click + touch
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

  // Gestion de l'abandon
  const handleAbandon = useCallback(async () => {
    cancelAnimationFrame(rafIdRef.current)
    router.push('/client')
  }, [router])

  // Calcul de la progression temporelle
  const progressValue = Math.min(
    (elapsedSeconds / config.duration_seconds) * 100,
    100
  )
  const progressLabel = `${Math.floor(elapsedSeconds / 60)}:${String(elapsedSeconds % 60).padStart(2, '0')} / ${Math.floor(config.duration_seconds / 60)} min`

  if (error) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-gray-950 text-white">
        <p className="text-red-400">{error}</p>
      </div>
    )
  }

  return (
    <CognitiveTestShell
      title={`PVT — Trial ${trialIndex}`}
      progressValue={progressValue}
      progressLabel={progressLabel}
      onAbandon={handleAbandon}
    >
      <div
        className="flex flex-col items-center justify-center w-full h-full cursor-pointer select-none"
        onClick={handleResponse}
        onTouchStart={(e) => { e.preventDefault(); handleResponse() }}
        style={{ WebkitTapHighlightColor: 'transparent' }}
        role="button"
        tabIndex={0}
        aria-label="Zone de réponse PVT"
      >
        {phase === 'fixation' && (
          <span className="text-white text-4xl font-light opacity-50">+</span>
        )}

        {phase === 'stimulus' && (
          <span
            ref={counterDomRef}
            className="font-mono text-red-500 font-bold leading-none"
            style={{ fontSize: '5rem' }}
          >
            0
          </span>
        )}

        {phase === 'feedback' && (
          <RTDisplay rt={currentRt} />
        )}

        {phase === 'anticipation' && (
          <span className="text-yellow-400 text-3xl font-semibold">Trop tôt !</span>
        )}

        {phase === 'complete' && (
          <div className="flex flex-col items-center gap-3 text-center">
            <span className="text-2xl">Test terminé</span>
            <span className="text-gray-400">Calcul des résultats en cours…</span>
          </div>
        )}
      </div>
    </CognitiveTestShell>
  )
}
