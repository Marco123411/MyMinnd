'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { createCognitiveSessionAction } from '@/app/actions/cognitive'

interface CognitiveLandingClientProps {
  slug: string
}

export function CognitiveLandingClient({ slug }: CognitiveLandingClientProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Avertissement appareil mobile bas de gamme
  const isLowEndDevice =
    typeof window !== 'undefined' &&
    (window.devicePixelRatio < 1.5 || window.screen.width < 375)

  async function handleStart() {
    setLoading(true)
    setError(null)

    // Capture des informations sur l'appareil pour contextualiser les RT
    const deviceInfo = {
      userAgent: navigator.userAgent,
      screenWidth: window.screen.width,
      screenHeight: window.screen.height,
      devicePixelRatio: window.devicePixelRatio,
      inputType: navigator.maxTouchPoints > 0 ? 'touch' : 'mouse',
    }

    const { data, error: actionError } = await createCognitiveSessionAction(slug, deviceInfo)

    if (actionError || !data) {
      setError(actionError ?? 'Erreur inattendue')
      setLoading(false)
      return
    }

    router.push(`/test/cognitive/${slug}/${data.sessionId}`)
  }

  return (
    <div className="space-y-3">
      {isLowEndDevice && (
        <p className="text-xs text-yellow-400/70 text-center bg-yellow-950/20 rounded-lg px-3 py-2">
          ⚠ Appareil détecté comme peu performant — les temps de réaction mesurés pourraient être moins précis.
        </p>
      )}
      <Button
        onClick={handleStart}
        disabled={loading}
        className="w-full bg-[#7069F4] hover:bg-[#5B54D6] text-white font-semibold h-12 text-base rounded-xl"
      >
        {loading ? 'Démarrage…' : 'Commencer le test'}
      </Button>
      {error && <p className="text-center text-sm text-red-400">{error}</p>}
    </div>
  )
}
