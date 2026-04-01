'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { recordCognitiveTrialsAction } from '@/app/actions/cognitive'
import type { TrialInput } from '@/types'

const BATCH_SIZE = 10
const FLUSH_INTERVAL_MS = 30_000

// Garde SSR : localStorage n'existe que côté client
function safeLocalStorage() {
  if (typeof window === 'undefined') return null
  return window.localStorage
}

export function useTrialRecorder(
  sessionId: string,
  onError?: (err: string) => void
): {
  recordTrial: (trial: TrialInput) => void
  flush: () => Promise<void>
  pendingCount: number
} {
  const bufferRef = useRef<TrialInput[]>([])
  const [pendingCount, setPendingCount] = useState(0)
  const isFlushing = useRef(false)
  // Wrapper stable pour onError afin d'éviter les re-créations de flush
  const onErrorRef = useRef(onError)
  onErrorRef.current = onError

  // Envoie le buffer courant au serveur, avec fallback localStorage.
  // Ne vide le buffer qu'après confirmation serveur pour éviter la perte de données.
  const flush = useCallback(async () => {
    if (isFlushing.current || bufferRef.current.length === 0) return
    isFlushing.current = true

    const batch = [...bufferRef.current]

    const { error } = await recordCognitiveTrialsAction(sessionId, batch)

    if (error) {
      // Fallback : stocker localement pour retry ultérieur
      const storage = safeLocalStorage()
      if (storage) {
        const key = `cognitive_trials_${sessionId}`
        const existing = JSON.parse(storage.getItem(key) ?? '[]') as TrialInput[]
        storage.setItem(key, JSON.stringify([...existing, ...batch]))
      }
      onErrorRef.current?.(error)
    } else {
      // Succès : vider seulement les trials envoyés, conserver les nouveaux arrivés pendant l'envoi
      bufferRef.current = bufferRef.current.slice(batch.length)
      setPendingCount(bufferRef.current.length)
    }

    isFlushing.current = false

    // Re-flush si de nouveaux trials se sont accumulés pendant cet envoi
    if (bufferRef.current.length >= BATCH_SIZE) {
      flush()
    }
  }, [sessionId])

  // Au montage : tenter de renvoyer les trials stockés localement
  useEffect(() => {
    const storage = safeLocalStorage()
    if (!storage) return
    const key = `cognitive_trials_${sessionId}`
    const stored = storage.getItem(key)
    if (!stored) return

    const pending = JSON.parse(stored) as TrialInput[]
    if (pending.length === 0) return

    storage.removeItem(key)
    recordCognitiveTrialsAction(sessionId, pending).then(({ error }) => {
      if (error) {
        storage.setItem(key, stored)
        onErrorRef.current?.(error)
      }
    })
  }, [sessionId])

  // Flush automatique toutes les 30 secondes
  useEffect(() => {
    const interval = setInterval(flush, FLUSH_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [flush])

  // Flush au démontage du composant
  useEffect(() => {
    return () => {
      if (bufferRef.current.length > 0) {
        flush()
      }
    }
  }, [flush])

  const recordTrial = useCallback(
    (trial: TrialInput) => {
      bufferRef.current.push(trial)
      const newCount = bufferRef.current.length
      setPendingCount(newCount)

      if (newCount >= BATCH_SIZE) {
        flush()
      }
    },
    [flush]
  )

  return { recordTrial, flush, pendingCount }
}
