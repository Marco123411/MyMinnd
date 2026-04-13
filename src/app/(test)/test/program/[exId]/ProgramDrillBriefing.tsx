'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { PhaseIndicator } from '@/components/cognitive/PhaseIndicator'
import { IntensityDisplay } from '@/components/cognitive/IntensityDisplay'
import CognitiveLoadBadge from '@/components/cognitive/CognitiveLoadBadge'
import { computeCognitiveLoad } from '@/lib/cognitive/load'
import { createCognitiveSessionAction } from '@/app/actions/cognitive'
import type { CognitiveTestDefinition, ProgramExercise, ResolvedTestParams } from '@/types'

interface Props {
  params: ResolvedTestParams
  testDef: CognitiveTestDefinition
  programExercise: ProgramExercise
}

function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  if (s === 0) return `${m} minute${m > 1 ? 's' : ''}`
  return `${m}m ${s}s`
}

export function ProgramDrillBriefing({ params, testDef, programExercise }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const cls = computeCognitiveLoad({
    baseCognitiveLoad: testDef.base_cognitive_load ?? 5,
    durationSec: params.durationSec,
    intensityPercent: params.intensityPercent,
    intensityConfigurable: testDef.intensity_configurable ?? false,
  })

  const handleStart = async () => {
    setLoading(true)
    setError(null)

    const deviceInfo = {
      userAgent: navigator.userAgent,
      screenWidth: window.screen.width,
      screenHeight: window.screen.height,
      devicePixelRatio: window.devicePixelRatio,
      inputType: ('ontouchstart' in window ? 'touch' : 'mouse') as 'touch' | 'mouse',
    }

    const { data, error: actionError } = await createCognitiveSessionAction(
      testDef.slug,
      deviceInfo,
      params.programExerciseId ?? undefined
    )

    if (actionError || !data) {
      setError(actionError ?? 'Erreur lors de la création de la session')
      setLoading(false)
      return
    }

    // Naviguer vers l'exécution du test avec le contexte programme
    router.push(
      `/test/cognitive/${testDef.slug}/${data.sessionId}?exId=${programExercise.id}`
    )
  }

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4 py-8"
      style={{ backgroundColor: '#1A1A2E' }}
    >
      <div className="w-full max-w-md space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          {params.phaseContext && (
            <div className="flex justify-center">
              <PhaseIndicator phase={params.phaseContext} />
            </div>
          )}
          <h1 className="text-2xl font-bold text-white">{testDef.name}</h1>
          {testDef.description && (
            <p className="text-gray-400 text-sm">{testDef.description}</p>
          )}
        </div>

        {/* Infos du drill */}
        <div className="bg-gray-900 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-gray-300">
              <span className="text-lg">⏱</span>
              <span className="font-medium">{formatDuration(params.durationSec)}</span>
            </div>
            {testDef.intensity_configurable && (
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 text-gray-300">
                  <span className="text-lg">⚡</span>
                  <span className="font-medium">{params.intensityPercent}% intensité</span>
                </div>
                <IntensityDisplay percent={params.intensityPercent} />
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 text-gray-300">
            <span className="text-lg">🧠</span>
            <span className="text-sm">Charge cognitive :</span>
            <CognitiveLoadBadge score={cls} />
          </div>
        </div>

        {/* Instructions */}
        {testDef.instructions_fr && (
          <div className="bg-gray-900/60 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-gray-300 mb-2">Instructions</h3>
            <p className="text-gray-400 text-sm leading-relaxed">{testDef.instructions_fr}</p>
          </div>
        )}

        {/* Error */}
        {error && (
          <p className="text-red-400 text-sm text-center">{error}</p>
        )}

        {/* CTA */}
        <button
          onClick={handleStart}
          disabled={loading}
          className="w-full py-4 rounded-2xl font-bold text-lg text-white transition-all active:scale-95 disabled:opacity-50"
          style={{ backgroundColor: '#20808D' }}
        >
          {loading ? 'Chargement…' : 'Commencer le test'}
        </button>

        <button
          onClick={() => router.push('/client/programme')}
          className="w-full py-2 text-gray-500 text-sm hover:text-gray-300 transition-colors"
        >
          Annuler
        </button>
      </div>
    </div>
  )
}
