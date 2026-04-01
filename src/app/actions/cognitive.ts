'use server'

import { createClient, createAdminClient } from '@/lib/supabase/server'
import { z } from 'zod'
import { scoreSession } from '@/lib/cognitive/scoring'
import type { TrialInput, CognitiveTestDefinition, CognitiveSession } from '@/types'

// Schémas de validation Zod
const slugSchema = z.object({ slug: z.string().min(1).max(50) })
const sessionIdSchema = z.object({ sessionId: z.string().uuid() })

const trialInputSchema = z.object({
  trial_index: z.number().int().min(0),
  stimulus_type: z.string().min(1).max(50),
  stimulus_data: z.record(z.string(), z.unknown()),
  response_data: z.record(z.string(), z.unknown()).nullable(),
  reaction_time_ms: z.number().int().min(0).nullable(),
  is_correct: z.boolean().nullable(),
  is_anticipation: z.boolean(),
  is_lapse: z.boolean(),
})

const recordTrialsSchema = z.object({
  sessionId: z.string().uuid(),
  trials: z.array(trialInputSchema).min(1).max(100),
})

const deviceInfoSchema = z.object({
  userAgent: z.string().max(500),
  screenWidth: z.number(),
  screenHeight: z.number(),
  devicePixelRatio: z.number(),
  inputType: z.enum(['touch', 'mouse']),
})

// Récupère la définition d'un test cognitif par son slug
export async function getCognitiveTestDefinitionBySlugAction(
  slug: string
): Promise<{ data: CognitiveTestDefinition | null; error: string | null }> {
  const parsed = slugSchema.safeParse({ slug })
  if (!parsed.success) return { data: null, error: parsed.error.issues[0].message }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { data: null, error: 'Non authentifié' }

  const { data, error } = await supabase
    .from('cognitive_test_definitions')
    .select('*')
    .eq('slug', parsed.data.slug)
    .eq('is_active', true)
    .single()

  if (error) return { data: null, error: error.message }
  return { data: data as CognitiveTestDefinition, error: null }
}

// Crée une session cognitive pour l'utilisateur connecté
export async function createCognitiveSessionAction(
  slug: string,
  deviceInfo: Record<string, unknown>
): Promise<{ data: { sessionId: string; definition: CognitiveTestDefinition } | null; error: string | null }> {
  const parsedSlug = slugSchema.safeParse({ slug })
  if (!parsedSlug.success) return { data: null, error: parsedSlug.error.issues[0].message }

  const parsedDevice = deviceInfoSchema.safeParse(deviceInfo)
  if (!parsedDevice.success) return { data: null, error: parsedDevice.error.issues[0].message }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { data: null, error: 'Non authentifié' }

  // Récupérer la définition du test
  const { data: definition, error: defError } = await supabase
    .from('cognitive_test_definitions')
    .select('*')
    .eq('slug', parsedSlug.data.slug)
    .eq('is_active', true)
    .single()

  if (defError || !definition) return { data: null, error: defError?.message ?? 'Test introuvable' }

  // Réutiliser une session active existante si elle existe déjà
  const { data: existing } = await supabase
    .from('cognitive_sessions')
    .select('id')
    .eq('user_id', user.id)
    .eq('cognitive_test_id', definition.id)
    .in('status', ['pending', 'in_progress'])
    .single()

  if (existing) {
    return { data: { sessionId: existing.id, definition: definition as CognitiveTestDefinition }, error: null }
  }

  // Créer une nouvelle session
  const { data: session, error: sessionError } = await supabase
    .from('cognitive_sessions')
    .insert({
      user_id: user.id,
      cognitive_test_id: definition.id,
      status: 'in_progress',
      started_at: new Date().toISOString(),
      device_info: parsedDevice.data,
    })
    .select('id')
    .single()

  if (sessionError) return { data: null, error: sessionError.message }

  return {
    data: { sessionId: session.id, definition: definition as CognitiveTestDefinition },
    error: null,
  }
}

// Récupère une session avec sa définition de test (vérifie que l'utilisateur est propriétaire)
export async function getCognitiveSessionWithDefinitionAction(
  sessionId: string
): Promise<{
  data: { session: CognitiveSession; definition: CognitiveTestDefinition } | null
  error: string | null
}> {
  const parsed = sessionIdSchema.safeParse({ sessionId })
  if (!parsed.success) return { data: null, error: parsed.error.issues[0].message }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { data: null, error: 'Non authentifié' }

  const { data, error } = await supabase
    .from('cognitive_sessions')
    .select('*, cognitive_test_definitions(*)')
    .eq('id', parsed.data.sessionId)
    .eq('user_id', user.id)
    .single()

  if (error || !data) return { data: null, error: error?.message ?? 'Session introuvable' }

  const definition = data.cognitive_test_definitions as CognitiveTestDefinition
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { cognitive_test_definitions: _def, ...sessionData } = data

  return {
    data: {
      session: sessionData as CognitiveSession,
      definition,
    },
    error: null,
  }
}

// Enregistre un batch de trials en base (appelé toutes les 10 trials ou 30s)
export async function recordCognitiveTrialsAction(
  sessionId: string,
  trials: TrialInput[]
): Promise<{ error: string | null }> {
  const parsed = recordTrialsSchema.safeParse({ sessionId, trials })
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' }

  // Vérifier que la session appartient à l'utilisateur et est en cours
  const { data: session, error: sessionError } = await supabase
    .from('cognitive_sessions')
    .select('id, status')
    .eq('id', parsed.data.sessionId)
    .eq('user_id', user.id)
    .single()

  if (sessionError || !session) return { error: 'Session introuvable' }
  if (session.status !== 'in_progress') return { error: 'Session non active' }

  // Insertion batch des trials
  const rows = parsed.data.trials.map((t) => ({
    session_id: parsed.data.sessionId,
    trial_index: t.trial_index,
    stimulus_type: t.stimulus_type,
    stimulus_data: t.stimulus_data,
    response_data: t.response_data,
    reaction_time_ms: t.reaction_time_ms,
    is_correct: t.is_correct,
    is_anticipation: t.is_anticipation,
    is_lapse: t.is_lapse,
  }))

  const { error } = await supabase.from('cognitive_trials').insert(rows)
  if (error) return { error: error.message }

  return { error: null }
}

// Marque la session comme terminée (déclenche le scoring côté serveur — étape 19)
export async function completeCognitiveSessionAction(
  sessionId: string
): Promise<{ data: { sessionId: string } | null; error: string | null }> {
  const parsed = sessionIdSchema.safeParse({ sessionId })
  if (!parsed.success) return { data: null, error: parsed.error.issues[0].message }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { data: null, error: 'Non authentifié' }

  // Vérifier propriété et statut
  const { data: session, error: sessionError } = await supabase
    .from('cognitive_sessions')
    .select('id, status')
    .eq('id', parsed.data.sessionId)
    .eq('user_id', user.id)
    .single()

  if (sessionError || !session) return { data: null, error: 'Session introuvable' }
  if (session.status !== 'in_progress') return { data: null, error: 'Session non active' }

  // Marquer comme complétée
  const { error } = await supabase
    .from('cognitive_sessions')
    .update({ status: 'completed', completed_at: new Date().toISOString() })
    .eq('id', parsed.data.sessionId)
    .eq('user_id', user.id)

  if (error) return { data: null, error: error.message }

  // Calculer les métriques depuis les trials bruts
  const { data: trialsData } = await supabase
    .from('cognitive_trials')
    .select('stimulus_type, stimulus_data, response_data, reaction_time_ms, is_correct, is_anticipation, is_lapse')
    .eq('session_id', parsed.data.sessionId)

  const { data: defData } = await supabase
    .from('cognitive_sessions')
    .select('cognitive_test_definitions(slug)')
    .eq('id', parsed.data.sessionId)
    .single()

  if (trialsData && defData) {
    const rawDef = (defData as { cognitive_test_definitions: { slug: string } | { slug: string }[] | null })
      .cognitive_test_definitions
    const slug = (Array.isArray(rawDef) ? rawDef[0]?.slug : rawDef?.slug) ?? ''
    // computed_metrics est révoqué pour `authenticated` — on utilise le service_role
    const metrics = scoreSession(slug, trialsData)
    const admin = createAdminClient()
    await admin
      .from('cognitive_sessions')
      .update({ computed_metrics: metrics })
      .eq('id', parsed.data.sessionId)
  }

  return { data: { sessionId: parsed.data.sessionId }, error: null }
}
