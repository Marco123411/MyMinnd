'use client'

import { useCallback } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import { completeCognitiveSessionAction } from '@/app/actions/cognitive'
import { markProgramExerciseCompleteAction } from '@/app/actions/programmes'
import type { PVTConfig, StroopConfig, SimonConfig, DigitalSpanConfig } from '@/types'

const PVTTest = dynamic(() => import('@/components/cognitive/PVTTest').then((m) => ({ default: m.PVTTest })), { ssr: false })
const StroopTest = dynamic(() => import('@/components/cognitive/StroopTest').then((m) => ({ default: m.StroopTest })), { ssr: false })
const SimonTest = dynamic(() => import('@/components/cognitive/SimonTest').then((m) => ({ default: m.SimonTest })), { ssr: false })
const DigitalSpanTest = dynamic(() => import('@/components/cognitive/DigitalSpanTest').then((m) => ({ default: m.DigitalSpanTest })), { ssr: false })

// Nouveaux drills
const GoNoGoVisual = dynamic(() => import('@/components/cognitive/drills/GoNoGoVisual').then((m) => ({ default: m.GoNoGoVisual })), { ssr: false })
const MackworthClock = dynamic(() => import('@/components/cognitive/drills/MackworthClock').then((m) => ({ default: m.MackworthClock })), { ssr: false })
const FlankerTest = dynamic(() => import('@/components/cognitive/drills/FlankerTest').then((m) => ({ default: m.FlankerTest })), { ssr: false })
const StopSignalTask = dynamic(() => import('@/components/cognitive/drills/StopSignalTask').then((m) => ({ default: m.StopSignalTask })), { ssr: false })
const SpatialSpan = dynamic(() => import('@/components/cognitive/drills/SpatialSpan').then((m) => ({ default: m.SpatialSpan })), { ssr: false })
const NBackTest = dynamic(() => import('@/components/cognitive/drills/NBackTest').then((m) => ({ default: m.NBackTest })), { ssr: false })
const VisualChoice4 = dynamic(() => import('@/components/cognitive/drills/VisualChoice4').then((m) => ({ default: m.VisualChoice4 })), { ssr: false })
const VisualSearch = dynamic(() => import('@/components/cognitive/drills/VisualSearch').then((m) => ({ default: m.VisualSearch })), { ssr: false })

interface Props {
  slug: string
  sessionId: string
  config: PVTConfig | StroopConfig | SimonConfig | DigitalSpanConfig
  durationSec?: number
  intensityPercent?: number
  programExerciseId?: string
}

// Slugs des nouveaux drills qui utilisent le pattern onComplete()
const NEW_DRILL_SLUGS = [
  'go-nogo-visual', 'mackworth-clock', 'flanker', 'stop-signal',
  'spatial-span', 'n-back-2', 'visual-choice-4', 'visual-search',
]

export function CognitiveTestRunner({ slug, sessionId, config, durationSec, intensityPercent, programExerciseId }: Props) {
  const router = useRouter()

  // Callback commun pour les nouveaux drills : complète la session puis redirige
  const handleDrillComplete = useCallback(async () => {
    await completeCognitiveSessionAction(sessionId)
    if (programExerciseId) {
      await markProgramExerciseCompleteAction(programExerciseId)
      router.push('/client/programme')
    } else {
      router.push(`/test/cognitive/${slug}/results/${sessionId}`)
    }
  }, [sessionId, programExerciseId, slug, router])

  // Nouveaux drills — valeurs par défaut uniquement ici (DrillProps exige number)
  if (NEW_DRILL_SLUGS.includes(slug)) {
    const drillProps = { sessionId, durationSec: durationSec ?? 300, intensityPercent: intensityPercent ?? 100, onComplete: handleDrillComplete }

    switch (slug) {
      case 'go-nogo-visual':
        return <GoNoGoVisual {...drillProps} />
      case 'mackworth-clock':
        return <MackworthClock {...drillProps} />
      case 'flanker':
        return <FlankerTest {...drillProps} />
      case 'stop-signal':
        return <StopSignalTask {...drillProps} />
      case 'spatial-span':
        return <SpatialSpan {...drillProps} />
      case 'n-back-2':
        return <NBackTest {...drillProps} />
      case 'visual-choice-4':
        return <VisualChoice4 {...drillProps} />
      case 'visual-search':
        return <VisualSearch {...drillProps} />
    }
  }

  // Tests existants avec props dynamiques
  switch (slug) {
    case 'pvt':
      return <PVTTest sessionId={sessionId} config={config as PVTConfig} />
    case 'stroop':
      return <StroopTest sessionId={sessionId} config={config as StroopConfig} durationSec={durationSec} intensityPercent={intensityPercent} />
    case 'simon':
      return <SimonTest sessionId={sessionId} config={config as SimonConfig} durationSec={durationSec} intensityPercent={intensityPercent} />
    case 'digital_span':
      return <DigitalSpanTest sessionId={sessionId} config={config as DigitalSpanConfig} durationSec={durationSec} intensityPercent={intensityPercent} />
    default:
      return null
  }
}
