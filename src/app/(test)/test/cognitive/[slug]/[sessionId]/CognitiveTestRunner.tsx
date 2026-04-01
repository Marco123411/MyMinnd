'use client'

import dynamic from 'next/dynamic'
import type { PVTConfig, StroopConfig, SimonConfig, DigitalSpanConfig } from '@/types'

const PVTTest = dynamic(() => import('@/components/cognitive/PVTTest').then((m) => ({ default: m.PVTTest })), { ssr: false })
const StroopTest = dynamic(() => import('@/components/cognitive/StroopTest').then((m) => ({ default: m.StroopTest })), { ssr: false })
const SimonTest = dynamic(() => import('@/components/cognitive/SimonTest').then((m) => ({ default: m.SimonTest })), { ssr: false })
const DigitalSpanTest = dynamic(() => import('@/components/cognitive/DigitalSpanTest').then((m) => ({ default: m.DigitalSpanTest })), { ssr: false })

interface Props {
  slug: string
  sessionId: string
  config: PVTConfig | StroopConfig | SimonConfig | DigitalSpanConfig
}

export function CognitiveTestRunner({ slug, sessionId, config }: Props) {
  switch (slug) {
    case 'pvt':
      return <PVTTest sessionId={sessionId} config={config as PVTConfig} />
    case 'stroop':
      return <StroopTest sessionId={sessionId} config={config as StroopConfig} />
    case 'simon':
      return <SimonTest sessionId={sessionId} config={config as SimonConfig} />
    case 'digital_span':
      return <DigitalSpanTest sessionId={sessionId} config={config as DigitalSpanConfig} />
    default:
      return null
  }
}
