'use server'

import { createClient, createAdminClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import type { CognitiveTestResult } from '@/types'

const uuidSchema = z.string().uuid()
const slugSchema = z.string().min(1).max(50)

// Structure retournée pour une session cognitive avec sa définition
export interface CognitiveSessionWithDefinition {
  id: string
  completed_at: string
  cognitive_test_id: string
  test_slug: string
  test_name: string
  computed_metrics: CognitiveTestResult | null
  benchmark_results: Array<{ metric: string; value: number; zone: 'elite' | 'average' | 'poor' }> | null
  preset_id: string | null
  preset_slug: string | null
  preset_name: string | null
  is_preset_validated: boolean | null
  programme_etape_id: string | null
}

// Helper interne : transforme une ligne Supabase en CognitiveSessionWithDefinition
function mapRowToSession(s: {
  id: string
  completed_at: string | null
  cognitive_test_id: string
  computed_metrics: unknown
  benchmark_results: unknown
  preset_id: string | null
  cognitive_test_definitions: unknown
  cognitive_test_presets: unknown
  programme_etape_id?: string | null
}): CognitiveSessionWithDefinition {
  const raw = s.cognitive_test_definitions
  const def = (Array.isArray(raw) ? raw[0] : raw) as { slug: string; name: string } | null
  const rawPreset = s.cognitive_test_presets
  const preset = (Array.isArray(rawPreset) ? rawPreset[0] : rawPreset) as { slug: string; name: string; is_validated: boolean } | null
  return {
    id: s.id,
    completed_at: s.completed_at ?? '',
    cognitive_test_id: s.cognitive_test_id,
    test_slug: def?.slug ?? '',
    test_name: def?.name ?? '',
    computed_metrics: s.computed_metrics as CognitiveTestResult | null,
    benchmark_results: s.benchmark_results as Array<{ metric: string; value: number; zone: 'elite' | 'average' | 'poor' }> | null,
    preset_id: s.preset_id ?? null,
    preset_slug: preset?.slug ?? null,
    preset_name: preset?.name ?? null,
    is_preset_validated: preset?.is_validated ?? null,
    programme_etape_id: s.programme_etape_id ?? null,
  }
}

const SESSION_SELECT = 'id, completed_at, cognitive_test_id, computed_metrics, benchmark_results, preset_id, programme_etape_id, cognitive_test_definitions(slug, name), cognitive_test_presets(slug, name, is_validated)'

// ── Pour le CRM Coach ─────────────────────────────────────────────────────────

// Récupère toutes les sessions cognitives complètes d'un client (vue coach)
export async function getCognitiveSessionsForClient(
  clientId: string
): Promise<{ data: CognitiveSessionWithDefinition[]; error: string | null }> {
  const parsed = uuidSchema.safeParse(clientId)
  if (!parsed.success) return { data: [], error: 'clientId invalide' }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { data: [], error: 'Non authentifié' }

  // Récupérer le user_id du client depuis le CRM
  const { data: clientData, error: clientError } = await supabase
    .from('clients')
    .select('user_id')
    .eq('id', parsed.data)
    .eq('coach_id', user.id)
    .single()

  if (clientError || !clientData?.user_id) return { data: [], error: null }

  // Utiliser admin client : la RLS de cognitive_sessions limite SELECT à user_id = auth.uid().
  // Le coach a déjà été vérifié propriétaire de ce client (clients.coach_id = user.id).
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('cognitive_sessions')
    .select(SESSION_SELECT)
    .eq('user_id', clientData.user_id)
    .eq('status', 'completed')
    .order('completed_at', { ascending: false })

  if (error) return { data: [], error: error.message }
  return { data: (data ?? []).map(mapRowToSession), error: null }
}

// Récupère le nombre de tests cognitifs complétés ce mois pour les clients d'un coach
export async function getCoachCognitiveStatsAction(): Promise<{
  data: { count: number; recent: CognitiveSessionWithDefinition[] } | null
  error: string | null
}> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { data: null, error: 'Non authentifié' }

  // UTC pour éviter les décalages de fuseau horaire en dev/prod
  const startOfMonth = new Date()
  startOfMonth.setUTCDate(1)
  startOfMonth.setUTCHours(0, 0, 0, 0)

  const { data, error } = await supabase
    .from('cognitive_sessions')
    .select(SESSION_SELECT)
    .eq('coach_id', user.id)
    .eq('status', 'completed')
    .order('completed_at', { ascending: false })
    .limit(50)

  if (error) return { data: null, error: error.message }

  const all = data ?? []
  const thisMonth = all.filter(
    (s) => s.completed_at && new Date(s.completed_at) >= startOfMonth
  )

  return {
    data: { count: thisMonth.length, recent: all.slice(0, 5).map(mapRowToSession) },
    error: null,
  }
}

// ── Pour l'Espace Client ──────────────────────────────────────────────────────

// Récupère les sessions cognitives du client connecté
export async function getClientCognitiveSessions(): Promise<{
  data: CognitiveSessionWithDefinition[]
  error: string | null
}> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { data: [], error: 'Non authentifié' }

  const { data, error } = await supabase
    .from('cognitive_sessions')
    .select(SESSION_SELECT)
    .eq('user_id', user.id)
    .eq('status', 'completed')
    .order('completed_at', { ascending: false })

  if (error) return { data: [], error: error.message }
  return { data: (data ?? []).map(mapRowToSession), error: null }
}

// ── Trials pour histogramme RT ────────────────────────────────────────────────

export interface TrialForHistogram {
  reaction_time_ms: number | null
  is_correct: boolean | null
  is_anticipation: boolean | null
  stimulus_type: string | null
}

// Récupère les trials d'une session pour l'affichage de l'histogramme RT
export async function getCognitiveSessionTrials(
  sessionId: string
): Promise<{ data: TrialForHistogram[]; error: string | null }> {
  const parsed = uuidSchema.safeParse(sessionId)
  if (!parsed.success) return { data: [], error: 'sessionId invalide' }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { data: [], error: 'Non authentifié' }

  // Vérifier accès : propriétaire ou coach assigné
  const { data: session } = await supabase
    .from('cognitive_sessions')
    .select('user_id, coach_id')
    .eq('id', parsed.data)
    .or(`user_id.eq.${user.id},coach_id.eq.${user.id}`)
    .single()

  if (!session) return { data: [], error: 'Session introuvable ou accès refusé' }

  const { data, error } = await supabase
    .from('cognitive_trials')
    .select('reaction_time_ms, is_correct, is_anticipation, stimulus_type')
    .eq('session_id', parsed.data)
    .order('trial_index')

  if (error) return { data: [], error: error.message }
  return { data: (data ?? []) as TrialForHistogram[], error: null }
}

// ── Sessions en attente (pending/in_progress) ─────────────────────────────────

export interface PendingCognitiveSession {
  id: string
  test_slug: string
  test_name: string
  preset_name: string | null
  status: 'pending' | 'in_progress'
  created_at: string
}

const PENDING_SELECT = 'id, status, created_at, cognitive_test_definitions(slug, name), cognitive_test_presets(name)'

function mapPendingRow(s: {
  id: string
  status: string
  created_at: string
  cognitive_test_definitions: unknown
  cognitive_test_presets: unknown
}): PendingCognitiveSession {
  const def = (Array.isArray(s.cognitive_test_definitions) ? s.cognitive_test_definitions[0] : s.cognitive_test_definitions) as { slug: string; name: string } | null
  const preset = (Array.isArray(s.cognitive_test_presets) ? s.cognitive_test_presets[0] : s.cognitive_test_presets) as { name: string } | null
  return {
    id: s.id,
    test_slug: def?.slug ?? '',
    test_name: def?.name ?? '',
    preset_name: preset?.name ?? null,
    status: s.status as 'pending' | 'in_progress',
    created_at: s.created_at,
  }
}

// Coach — sessions pending/in_progress pour un client donné
export async function getPendingCognitiveSessionsForClient(
  clientId: string
): Promise<{ data: PendingCognitiveSession[]; error: string | null }> {
  const parsed = uuidSchema.safeParse(clientId)
  if (!parsed.success) return { data: [], error: 'clientId invalide' }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { data: [], error: 'Non authentifié' }

  const { data: clientData, error: clientError } = await supabase
    .from('clients')
    .select('user_id')
    .eq('id', parsed.data)
    .eq('coach_id', user.id)
    .single()

  if (clientError || !clientData?.user_id) return { data: [], error: null }

  const { data, error } = await supabase
    .from('cognitive_sessions')
    .select(PENDING_SELECT)
    .eq('user_id', clientData.user_id)
    .eq('coach_id', user.id)
    .in('status', ['pending', 'in_progress'])
    .order('created_at', { ascending: false })

  if (error) return { data: [], error: error.message }
  return { data: (data ?? []).map(mapPendingRow), error: null }
}

// Client — ses propres sessions pending/in_progress
export async function getMyPendingCognitiveSessions(): Promise<{
  data: PendingCognitiveSession[]
  error: string | null
}> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { data: [], error: 'Non authentifié' }

  const { data, error } = await supabase
    .from('cognitive_sessions')
    .select(PENDING_SELECT)
    .eq('user_id', user.id)
    .in('status', ['pending', 'in_progress'])
    .order('created_at', { ascending: false })

  if (error) return { data: [], error: error.message }
  return { data: (data ?? []).map(mapPendingRow), error: null }
}

// ── Invitation de test cognitif ───────────────────────────────────────────────

// Le coach crée une session pending pour un client (invitation sans token)
// La session est récupérée automatiquement quand le client démarre le test
export async function createCognitiveInvitationAction(
  clientId: string,
  testSlug: string,
  presetId?: string
): Promise<{ data: { inviteUrl: string; testSlug: string } | null; error: string | null }> {
  const parsedId = uuidSchema.safeParse(clientId)
  const parsedSlug = slugSchema.safeParse(testSlug)
  if (!parsedId.success) return { data: null, error: 'clientId invalide' }
  if (!parsedSlug.success) return { data: null, error: 'testSlug invalide' }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { data: null, error: 'Non authentifié' }

  // Requêtes client + test en parallèle (indépendantes)
  const [clientResult, testDefResult] = await Promise.all([
    supabase
      .from('clients')
      .select('user_id')
      .eq('id', parsedId.data)
      .eq('coach_id', user.id)
      .single(),
    supabase
      .from('cognitive_test_definitions')
      .select('id')
      .eq('slug', parsedSlug.data)
      .eq('is_active', true)
      .single(),
  ])

  if (clientResult.error || !clientResult.data?.user_id) {
    return { data: null, error: 'Client introuvable' }
  }
  if (testDefResult.error || !testDefResult.data) {
    return { data: null, error: 'Test introuvable' }
  }

  const clientData = clientResult.data
  const testDef = testDefResult.data

  // Vérifier si une session pending existe déjà pour ce client/test
  const { data: existing } = await supabase
    .from('cognitive_sessions')
    .select('id')
    .eq('user_id', clientData.user_id)
    .eq('cognitive_test_id', testDef.id)
    .in('status', ['pending', 'in_progress'])
    .single()

  if (existing) {
    return {
      data: { inviteUrl: `/test/cognitive/${parsedSlug.data}`, testSlug: parsedSlug.data },
      error: null,
    }
  }

  // Résoudre le preset si fourni — vérifier appartenance ET test correspondant
  let resolvedConfig: Record<string, unknown> | null = null
  let resolvedPresetId: string | null = null

  if (presetId) {
    const parsedPresetId = uuidSchema.safeParse(presetId)
    if (!parsedPresetId.success) return { data: null, error: 'presetId invalide' }

    const { data: preset } = await supabase
      .from('cognitive_test_presets')
      .select('id, config, coach_id, is_active')
      .eq('id', parsedPresetId.data)
      .eq('is_active', true)
      .eq('cognitive_test_id', testDef.id)  // Vérifier que le preset correspond au test
      .or(`coach_id.is.null,coach_id.eq.${user.id}`)
      .single()

    if (!preset) return { data: null, error: 'Preset introuvable' }
    resolvedConfig = preset.config as Record<string, unknown>
    resolvedPresetId = preset.id
  }

  // Créer la session pending avec coach_id assigné (utilise admin pour contourner RLS sur coach_id)
  const admin = createAdminClient()
  const { error: insertError } = await admin
    .from('cognitive_sessions')
    .insert({
      user_id: clientData.user_id,
      cognitive_test_id: testDef.id,
      coach_id: user.id,
      status: 'pending',
      preset_id: resolvedPresetId,
      config_used: resolvedConfig,
    })

  if (insertError) return { data: null, error: 'Impossible de créer l\'invitation' }

  revalidatePath(`/coach/clients/${parsedId.data}`)

  return {
    data: { inviteUrl: `/test/cognitive/${parsedSlug.data}`, testSlug: parsedSlug.data },
    error: null,
  }
}
