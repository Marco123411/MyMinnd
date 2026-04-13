'use client'

import { useEffect, useRef, useState } from 'react'

interface TestTimerProps {
  durationSec: number
  onExpire: () => void
}

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

export function TestTimer({ durationSec, onExpire }: TestTimerProps) {
  const [remaining, setRemaining] = useState(Math.max(0, durationSec))
  const onExpireRef = useRef(onExpire)
  onExpireRef.current = onExpire

  useEffect(() => {
    // Durée invalide — expirer immédiatement sans afficher le timer
    if (durationSec <= 0) {
      onExpireRef.current()
      return
    }

    const startTime = Date.now()
    setRemaining(durationSec)

    const interval = setInterval(() => {
      // Calcul basé sur Date.now() pour éviter la dérive de setInterval
      const elapsed = Math.floor((Date.now() - startTime) / 1000)
      const newRemaining = Math.max(0, durationSec - elapsed)
      setRemaining(newRemaining)
      if (newRemaining <= 0) {
        clearInterval(interval)
        onExpireRef.current()
      }
    }, 1000)
    return () => clearInterval(interval)
  }, [durationSec])

  const progressPercent = durationSec > 0 ? (remaining / durationSec) * 100 : 0

  return (
    <div className="sticky top-0 z-10 w-full bg-gray-900/90 backdrop-blur-sm border-b border-gray-800 px-4 py-2">
      <div className="flex items-center gap-3">
        <span className="text-gray-400 text-sm font-mono shrink-0">
          {formatTime(remaining)} restant
        </span>
        <div className="flex-1 h-1.5 bg-gray-800 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-1000"
            style={{
              width: `${progressPercent}%`,
              backgroundColor: progressPercent > 30 ? '#20808D' : progressPercent > 10 ? '#FFC553' : '#944454',
            }}
          />
        </div>
      </div>
    </div>
  )
}
