import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getCognitiveSessionWithDefinitionAction } from '@/app/actions/cognitive'
import { CognitiveTestRunner } from './CognitiveTestRunner'
import type { PVTConfig, StroopConfig, SimonConfig, DigitalSpanConfig } from '@/types'

interface PageProps {
  params: Promise<{ slug: string; sessionId: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
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

export default async function CognitiveTestPage({ params, searchParams }: PageProps) {
  const { slug, sessionId } = await params
  const sp = await searchParams
  const programExerciseId = typeof sp.exId === 'string' ? sp.exId : undefined

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
    redirect(`/test/cognitive/${definition.slug}/${sessionId}${programExerciseId ? `?exId=${programExerciseId}` : ''}`)
  }

  // Rediriger si la session n'est pas active
  if (session.status === 'completed') {
    redirect(`/test/cognitive/${definition.slug}/results/${sessionId}`)
  }
  if (session.status === 'abandoned') {
    redirect(`/test/cognitive/${definition.slug}`)
  }

  // Fusionner config résolue (preset > définition > défauts)
  const dbConfig = (session.config_used ?? definition.config ?? {}) as Record<string, unknown>

  const configMap: Record<string, PVTConfig | StroopConfig | SimonConfig | DigitalSpanConfig> = {
    pvt: { ...DEFAULT_PVT_CONFIG, ...dbConfig } as PVTConfig,
    stroop: { ...DEFAULT_STROOP_CONFIG, ...dbConfig } as StroopConfig,
    simon: { ...DEFAULT_SIMON_CONFIG, ...dbConfig } as SimonConfig,
    digital_span: { ...DEFAULT_DIGITAL_SPAN_CONFIG, ...dbConfig } as DigitalSpanConfig,
  }

  // Paramètres dynamiques depuis la session (définis si lancé depuis programme)
  const durationSec = (session.configured_duration_sec as number | null) ?? undefined
  const intensityPercent = (session.configured_intensity_percent as number | null) ?? undefined

  // Config par défaut pour les slugs inconnus (nouveaux drills sans config fixe)
  const config = configMap[definition.slug] ?? DEFAULT_STROOP_CONFIG

  return (
    <CognitiveTestRunner
      slug={definition.slug}
      sessionId={sessionId}
      config={config}
      durationSec={durationSec}
      intensityPercent={intensityPercent}
      programExerciseId={programExerciseId}
    />
  )
}
