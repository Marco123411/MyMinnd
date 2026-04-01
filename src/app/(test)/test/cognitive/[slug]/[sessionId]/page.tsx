import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getCognitiveSessionWithDefinitionAction } from '@/app/actions/cognitive'
import { CognitiveTestRunner } from './CognitiveTestRunner'
import type { PVTConfig, StroopConfig, SimonConfig, DigitalSpanConfig } from '@/types'

interface PageProps {
  params: Promise<{ slug: string; sessionId: string }>
}

// Configs par défaut si absentes de la BDD
const DEFAULT_PVT_CONFIG: PVTConfig = {
  duration_seconds: 1200,
  isi_min_ms: 2000,
  isi_max_ms: 10000,
  lapse_threshold_ms: 500,
  anticipation_threshold_ms: 100,
}
const DEFAULT_STROOP_CONFIG: StroopConfig = {
  trials_per_condition: 24,
  fixation_duration_ms: 500,
  feedback_duration_ms: 200,
  timeout_ms: 3000,
}
const DEFAULT_SIMON_CONFIG: SimonConfig = {
  trials_per_condition: 30,
  fixation_duration_ms: 500,
  timeout_ms: 3000,
}
const DEFAULT_DIGITAL_SPAN_CONFIG: DigitalSpanConfig = {
  min_span: 3,
  max_span: 12,
  digit_display_ms: 1000,
  inter_digit_ms: 300,
}

export default async function CognitiveTestPage({ params }: PageProps) {
  const { slug, sessionId } = await params

  // Vérifier que l'utilisateur est connecté
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data, error } = await getCognitiveSessionWithDefinitionAction(sessionId)
  if (error || !data) notFound()

  const { session, definition } = data

  // Canonicaliser l'URL si le slug ne correspond pas à la définition réelle
  if (slug !== definition.slug) {
    redirect(`/test/cognitive/${definition.slug}/${sessionId}`)
  }

  // Rediriger si la session n'est pas active
  if (session.status === 'completed') {
    redirect(`/test/cognitive/${definition.slug}/results/${sessionId}`)
  }
  if (session.status === 'abandoned') {
    redirect(`/test/cognitive/${definition.slug}`)
  }

  // Fusionner config résolue (preset > définition > défauts)
  // config_used est stocké au moment de la création de la session (immuable)
  const dbConfig = (session.config_used ?? definition.config ?? {}) as Record<string, unknown>

  const configMap: Record<string, PVTConfig | StroopConfig | SimonConfig | DigitalSpanConfig> = {
    pvt: { ...DEFAULT_PVT_CONFIG, ...dbConfig } as PVTConfig,
    stroop: { ...DEFAULT_STROOP_CONFIG, ...dbConfig } as StroopConfig,
    simon: { ...DEFAULT_SIMON_CONFIG, ...dbConfig } as SimonConfig,
    digital_span: { ...DEFAULT_DIGITAL_SPAN_CONFIG, ...dbConfig } as DigitalSpanConfig,
  }

  if (!configMap[definition.slug]) notFound()

  return (
    <CognitiveTestRunner
      slug={definition.slug}
      sessionId={sessionId}
      config={configMap[definition.slug]}
    />
  )
}
