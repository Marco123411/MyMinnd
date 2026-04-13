'use server'

import { createClient, createAdminClient } from '@/lib/supabase/server'
import { z } from 'zod'
import type {
  CabinetSession,
  AutonomousSession,
  AutonomousSessionEnrichi,
  RecurringTemplate,
  RecurringExecution,
  SessionHistoryItem,
  SessionsObservanceMetrics,
  ClientSelectOption,
  ExerciceOrdonné,
  Exercise,
} from '@/types'

// ============================================================
// Schémas de validation
// ============================================================

const exerciceOrdonnéSchema = z.object({
  exercise_id: z.string().uuid(),
  ordre: z.number().int().min(0),
  consignes: z.string(),
})

const planCabinetSessionSchema = z.object({
  client_id: z.string().uuid(),
  date_seance: z.string().min(1),
  objectif: z.string().min(1, 'L\'objectif est requis'),
  exercices_utilises: z.array(exerciceOrdonnéSchema).optional().default([]),
  contenu: z.string().optional(),
})

const updateCabinetSessionSchema = z.object({
  objectif: z.string().min(1).optional(),
  contenu: z.string().optional(),
  observations: z.string().optional(),
  prochaine_etape: z.string().optional(),
  duree_minutes: z.number().int().min(0).optional(),
  exercices_utilises: z.array(exerciceOrdonnéSchema).optional(),
  statut: z.enum(['planifiee', 'realisee', 'annulee']).optional(),
})

const assignAutonomousSessionSchema = z.object({
  client_id: z.string().uuid(),
  titre: z.string().min(1, 'Le titre est requis'),
  objectif: z.string().min(1, 'L\'objectif est requis'),
  exercices: z.array(exerciceOrdonnéSchema).min(1, 'Au moins un exercice est requis'),
  date_cible: z.string().optional().nullable(),
})

const updateAutonomousStatutSchema = z.object({
  statut: z.enum(['en_cours', 'terminee']),
  feedback_client: z.string().optional(),
  duree_realisee: z.number().int().min(0).optional(),
})

const createRecurringTemplateSchema = z.object({
  client_id: z.string().uuid(),
  titre: z.string().min(1, 'Le titre est requis'),
  description: z.string().optional(),
  exercices: z.array(exerciceOrdonnéSchema).min(1, 'Au moins un exercice est requis'),
  duree_estimee: z.number().int().min(0).optional().nullable(),
  trigger_type: z
    .enum(['pre_entrainement', 'pre_competition', 'quotidien', 'post_entrainement', 'libre'])
    .optional()
    .nullable(),
})

const executeTemplateSchema = z.object({
  template_id: z.string().uuid(),
  duree_minutes: z.number().int().min(0).optional(),
  feedback: z.string().optional(),
  data: z.record(z.string(), z.unknown()).optional(),
})

// ============================================================
// Helper: vérifie auth + rôle coach
// ============================================================
async function requireCoach() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { user: null, error: 'Non authentifié' as const }

  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()
  if (!profile || profile.role !== 'coach') {
    return { user: null, error: 'Accès réservé aux coachs' as const }
  }
  return { user, error: null }
}

// ============================================================
// Mise à jour automatique des statuts overdue
// Appelée avant chaque lecture des séances autonomie
// ============================================================
async function syncOverdueStatuses(): Promise<void> {
  const admin = createAdminClient()
  const { error } = await admin.rpc('update_overdue_autonomous_sessions')
  if (error) {
    // Log server-side uniquement — ne bloque pas la lecture
    console.error('[syncOverdueStatuses] Erreur mise à jour statuts:', error.message)
  }
}

// ============================================================
// SÉANCES CABINET
// ============================================================

/**
 * Récupère les séances cabinet du coach : upcoming + passées
 */
export async function getCabinetSessionsAction(): Promise<{
  upcoming: CabinetSession[]
  past: CabinetSession[]
  error: string | null
}> {
  const { user, error: authError } = await requireCoach()
  if (!user) return { upcoming: [], past: [], error: authError }

  const admin = createAdminClient()
  const now = new Date().toISOString()

  const { data, error } = await admin
    .from('cabinet_sessions')
    .select('*')
    .eq('coach_id', user.id)
    .order('date_seance', { ascending: false })

  if (error) return { upcoming: [], past: [], error: error.message }

  const sessions = (data ?? []) as CabinetSession[]
  const upcoming = sessions.filter(
    (s) => s.statut === 'planifiee' && s.date_seance >= now
  )
  const past = sessions.filter(
    (s) => s.statut !== 'planifiee' || s.date_seance < now
  )

  return { upcoming, past, error: null }
}

/**
 * Récupère une séance cabinet par ID (pour la page de compte-rendu)
 */
export async function getCabinetSessionAction(
  sessionId: string
): Promise<{ data: CabinetSession | null; error: string | null }> {
  const parsedId = z.string().uuid().safeParse(sessionId)
  if (!parsedId.success) return { data: null, error: 'ID de séance invalide' }

  const { user, error: authError } = await requireCoach()
  if (!user) return { data: null, error: authError }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('cabinet_sessions')
    .select('*')
    .eq('id', sessionId)
    .eq('coach_id', user.id)
    .single()

  if (error) return { data: null, error: error.message }
  return { data: data as CabinetSession, error: null }
}

/**
 * Planifie une nouvelle séance cabinet
 */
export async function createCabinetSessionAction(
  input: z.infer<typeof planCabinetSessionSchema>
): Promise<{ data: CabinetSession | null; error: string | null }> {
  const parsed = planCabinetSessionSchema.safeParse(input)
  if (!parsed.success) return { data: null, error: parsed.error.issues[0].message }

  const { user, error: authError } = await requireCoach()
  if (!user) return { data: null, error: authError }

  const admin = createAdminClient()

  // Vérifie que le client appartient au coach
  const { data: client } = await admin
    .from('clients')
    .select('id')
    .eq('user_id', parsed.data.client_id)
    .eq('coach_id', user.id)
    .single()
  if (!client) return { data: null, error: 'Client introuvable ou non autorisé' }

  const { data, error } = await admin
    .from('cabinet_sessions')
    .insert({
      coach_id: user.id,
      client_id: parsed.data.client_id,
      date_seance: parsed.data.date_seance,
      objectif: parsed.data.objectif,
      exercices_utilises: parsed.data.exercices_utilises,
      contenu: parsed.data.contenu ?? null,
    })
    .select()
    .single()

  if (error) return { data: null, error: error.message }
  return { data: data as CabinetSession, error: null }
}

/**
 * Met à jour une séance cabinet (compte-rendu, statut, notes)
 */
export async function updateCabinetSessionAction(
  sessionId: string,
  input: z.infer<typeof updateCabinetSessionSchema>
): Promise<{ error: string | null }> {
  const parsedId = z.string().uuid().safeParse(sessionId)
  if (!parsedId.success) return { error: 'ID de séance invalide' }

  const parsed = updateCabinetSessionSchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const { user, error: authError } = await requireCoach()
  if (!user) return { error: authError }

  const admin = createAdminClient()

  // Filtre sur coach_id pour garantir la propriété
  const updates: Record<string, unknown> = {}
  if (parsed.data.objectif !== undefined) updates.objectif = parsed.data.objectif
  if (parsed.data.contenu !== undefined) updates.contenu = parsed.data.contenu
  if (parsed.data.observations !== undefined) updates.observations = parsed.data.observations
  if (parsed.data.prochaine_etape !== undefined) updates.prochaine_etape = parsed.data.prochaine_etape
  if (parsed.data.exercices_utilises !== undefined) updates.exercices_utilises = parsed.data.exercices_utilises
  if (parsed.data.statut !== undefined) updates.statut = parsed.data.statut
  // Fix L4 : ne jamais écraser duree_minutes si la valeur n'est pas explicitement fournie
  if (parsed.data.duree_minutes !== undefined) updates.duree_minutes = parsed.data.duree_minutes

  const { error } = await admin
    .from('cabinet_sessions')
    .update(updates)
    .eq('id', sessionId)
    .eq('coach_id', user.id)

  if (error) return { error: error.message }
  return { error: null }
}

// ============================================================
// SÉANCES AUTONOMIE
// ============================================================

/**
 * Récupère toutes les séances autonomie du coach avec mise à jour des statuts overdue
 */
export async function getAutonomousSessionsAction(): Promise<{
  data: (AutonomousSession & { client_nom: string; client_prenom: string })[]
  error: string | null
}> {
  const { user, error: authError } = await requireCoach()
  if (!user) return { data: [], error: authError }

  // Met à jour les statuts overdue avant de lire
  await syncOverdueStatuses()

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('autonomous_sessions')
    .select(`
      *,
      users!autonomous_sessions_client_id_fkey (nom, prenom)
    `)
    .eq('coach_id', user.id)
    .order('created_at', { ascending: false })

  if (error) return { data: [], error: error.message }

  const enriched = (data ?? []).map((s) => ({
    ...s,
    client_nom: (s.users as { nom: string; prenom: string })?.nom ?? '',
    client_prenom: (s.users as { nom: string; prenom: string })?.prenom ?? '',
    exercices: (s.exercices ?? []) as ExerciceOrdonné[],
  }))

  return { data: enriched as (AutonomousSession & { client_nom: string; client_prenom: string })[], error: null }
}

/**
 * Récupère les séances autonomie du client connecté
 */
export async function getMyAutonomousSessionsAction(): Promise<{
  data: AutonomousSessionEnrichi[]
  error: string | null
}> {
  await syncOverdueStatuses()

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { data: [], error: 'Non authentifié' }

  const { data, error } = await supabase
    .from('autonomous_sessions')
    .select('*')
    .eq('client_id', user.id)
    .order('created_at', { ascending: false })

  if (error) return { data: [], error: error.message }

  const sessions = (data ?? []) as AutonomousSession[]

  // Collecte les exercise_ids uniques sur toutes les séances
  const exerciseIds = [...new Set(
    sessions.flatMap((s) => s.exercices.map((e) => e.exercise_id))
  )]

  // Récupère les données complètes des exercices (admin pour inclure les exercices custom du coach)
  const exerciseMap = new Map<string, Exercise>()
  if (exerciseIds.length > 0) {
    const admin = createAdminClient()
    const { data: exercises } = await admin
      .from('exercises')
      .select('*')
      .in('id', exerciseIds)
    for (const ex of exercises ?? []) {
      exerciseMap.set(ex.id as string, ex as Exercise)
    }
  }

  const enriched: AutonomousSessionEnrichi[] = sessions.map((s) => ({
    ...s,
    exercices: s.exercices.map((e) => ({
      ...e,
      exercise: exerciseMap.get(e.exercise_id) ?? null,
    })),
  }))

  return { data: enriched, error: null }
}

/**
 * Assigne une séance en autonomie à un client
 */
export async function createAutonomousSessionAction(
  input: z.infer<typeof assignAutonomousSessionSchema>
): Promise<{ data: AutonomousSession | null; error: string | null }> {
  const parsed = assignAutonomousSessionSchema.safeParse(input)
  if (!parsed.success) return { data: null, error: parsed.error.issues[0].message }

  const { user, error: authError } = await requireCoach()
  if (!user) return { data: null, error: authError }

  const admin = createAdminClient()

  // Vérifie ownership du client
  const { data: client } = await admin
    .from('clients')
    .select('id')
    .eq('user_id', parsed.data.client_id)
    .eq('coach_id', user.id)
    .single()
  if (!client) return { data: null, error: 'Client introuvable ou non autorisé' }

  const { data, error } = await admin
    .from('autonomous_sessions')
    .insert({
      coach_id: user.id,
      client_id: parsed.data.client_id,
      titre: parsed.data.titre,
      objectif: parsed.data.objectif,
      exercices: parsed.data.exercices,
      date_cible: parsed.data.date_cible ?? null,
    })
    .select()
    .single()

  if (error) return { data: null, error: error.message }
  return { data: data as AutonomousSession, error: null }
}

/**
 * Met à jour le statut d'une séance autonomie (par le client)
 */
export async function updateAutonomousSessionStatutAction(
  sessionId: string,
  input: z.infer<typeof updateAutonomousStatutSchema>
): Promise<{ error: string | null }> {
  const parsedId = z.string().uuid().safeParse(sessionId)
  if (!parsedId.success) return { error: 'ID de séance invalide' }

  const parsed = updateAutonomousStatutSchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' }

  // Guard machine d'état : transitions valides uniquement
  const VALID_TRANSITIONS: Record<string, string[]> = {
    a_faire: ['en_cours', 'terminee'],
    en_cours: ['terminee'],
    en_retard: ['en_cours', 'terminee'],
  }

  const { data: current } = await supabase
    .from('autonomous_sessions')
    .select('statut')
    .eq('id', sessionId)
    .eq('client_id', user.id)
    .single()

  if (!current) return { error: 'Séance introuvable' }
  const allowed = VALID_TRANSITIONS[current.statut] ?? []
  if (!allowed.includes(parsed.data.statut)) {
    return { error: `Transition de statut invalide: ${current.statut} → ${parsed.data.statut}` }
  }

  const updates: Record<string, unknown> = { statut: parsed.data.statut }
  if (parsed.data.statut === 'terminee') {
    updates.date_realisation = new Date().toISOString()
    if (parsed.data.feedback_client) updates.feedback_client = parsed.data.feedback_client
    if (parsed.data.duree_realisee !== undefined) updates.duree_realisee = parsed.data.duree_realisee
  }

  const { error } = await supabase
    .from('autonomous_sessions')
    .update(updates)
    .eq('id', sessionId)
    .eq('client_id', user.id)

  if (error) return { error: error.message }
  return { error: null }
}

// ============================================================
// TEMPLATES RÉCURRENTS
// ============================================================

/**
 * Récupère les templates récurrents du coach avec le nombre d'exécutions
 */
export async function getRecurringTemplatesAction(): Promise<{
  data: (RecurringTemplate & { execution_count: number; client_nom: string; client_prenom: string })[]
  error: string | null
}> {
  const { user, error: authError } = await requireCoach()
  if (!user) return { data: [], error: authError }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('recurring_templates')
    .select(`
      *,
      users!recurring_templates_client_id_fkey (nom, prenom),
      recurring_executions (id)
    `)
    .eq('coach_id', user.id)
    .order('created_at', { ascending: false })

  if (error) return { data: [], error: error.message }

  const enriched = (data ?? []).map((t) => ({
    ...t,
    execution_count: Array.isArray(t.recurring_executions) ? t.recurring_executions.length : 0,
    client_nom: (t.users as { nom: string; prenom: string })?.nom ?? '',
    client_prenom: (t.users as { nom: string; prenom: string })?.prenom ?? '',
    exercices: (t.exercices ?? []) as ExerciceOrdonné[],
  }))

  return { data: enriched as (RecurringTemplate & { execution_count: number; client_nom: string; client_prenom: string })[], error: null }
}

/**
 * Récupère les templates assignés au client connecté avec historique d'exécutions
 */
export async function getMyRecurringTemplatesAction(): Promise<{
  data: (RecurringTemplate & { executions: RecurringExecution[] })[]
  error: string | null
}> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { data: [], error: 'Non authentifié' }

  const { data, error } = await supabase
    .from('recurring_templates')
    .select(`
      *,
      recurring_executions (*)
    `)
    .eq('client_id', user.id)
    .eq('is_active', true)
    .order('created_at', { ascending: false })

  if (error) return { data: [], error: error.message }

  const enriched = (data ?? []).map((t) => ({
    ...t,
    exercices: (t.exercices ?? []) as ExerciceOrdonné[],
    executions: (Array.isArray(t.recurring_executions) ? t.recurring_executions : []) as RecurringExecution[],
  }))

  return { data: enriched as (RecurringTemplate & { executions: RecurringExecution[] })[], error: null }
}

/**
 * Crée un nouveau template récurrent
 */
export async function createRecurringTemplateAction(
  input: z.infer<typeof createRecurringTemplateSchema>
): Promise<{ data: RecurringTemplate | null; error: string | null }> {
  const parsed = createRecurringTemplateSchema.safeParse(input)
  if (!parsed.success) return { data: null, error: parsed.error.issues[0].message }

  const { user, error: authError } = await requireCoach()
  if (!user) return { data: null, error: authError }

  const admin = createAdminClient()

  // Vérifie ownership du client
  const { data: client } = await admin
    .from('clients')
    .select('id')
    .eq('user_id', parsed.data.client_id)
    .eq('coach_id', user.id)
    .single()
  if (!client) return { data: null, error: 'Client introuvable ou non autorisé' }

  const { data, error } = await admin
    .from('recurring_templates')
    .insert({
      coach_id: user.id,
      client_id: parsed.data.client_id,
      titre: parsed.data.titre,
      description: parsed.data.description ?? null,
      exercices: parsed.data.exercices,
      duree_estimee: parsed.data.duree_estimee ?? null,
      trigger_type: parsed.data.trigger_type ?? null,
    })
    .select()
    .single()

  if (error) return { data: null, error: error.message }
  return { data: data as RecurringTemplate, error: null }
}

/**
 * Enregistre une exécution d'un template récurrent (par le client)
 */
export async function executeRecurringTemplateAction(
  input: z.infer<typeof executeTemplateSchema>
): Promise<{ data: RecurringExecution | null; error: string | null }> {
  const parsed = executeTemplateSchema.safeParse(input)
  if (!parsed.success) return { data: null, error: parsed.error.issues[0].message }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { data: null, error: 'Non authentifié' }

  const { data, error } = await supabase
    .from('recurring_executions')
    .insert({
      template_id: parsed.data.template_id,
      client_id: user.id,
      completed: true,
      duree_minutes: parsed.data.duree_minutes ?? null,
      feedback: parsed.data.feedback ?? null,
      data: parsed.data.data ?? {},
    })
    .select()
    .single()

  if (error) return { data: null, error: error.message }
  return { data: data as RecurringExecution, error: null }
}

// ============================================================
// HISTORIQUE CLIENT (pour la fiche client coach)
// ============================================================

/**
 * Récupère l'historique complet des séances d'un client (pour le coach)
 */
export async function getClientSessionHistoryAction(clientId: string): Promise<{
  data: SessionHistoryItem[]
  error: string | null
}> {
  const parsedId = z.string().uuid().safeParse(clientId)
  if (!parsedId.success) return { data: [], error: 'ID client invalide' }

  const { user, error: authError } = await requireCoach()
  if (!user) return { data: [], error: authError }

  await syncOverdueStatuses()

  const admin = createAdminClient()

  const [cabinetRes, autonomousRes, executionsRes] = await Promise.all([
    admin
      .from('cabinet_sessions')
      .select('*')
      .eq('coach_id', user.id)
      .eq('client_id', clientId)
      .order('date_seance', { ascending: false }),
    admin
      .from('autonomous_sessions')
      .select('*')
      .eq('coach_id', user.id)
      .eq('client_id', clientId)
      .order('created_at', { ascending: false }),
    // Fix F2 : filtrer au niveau DB par coach_id du template pour éviter l'IDOR
    admin
      .from('recurring_executions')
      .select(`*, recurring_templates!inner(*)`)
      .eq('client_id', clientId)
      .eq('recurring_templates.coach_id', user.id)
      .order('started_at', { ascending: false }),
  ])

  if (cabinetRes.error) return { data: [], error: cabinetRes.error.message }
  if (autonomousRes.error) return { data: [], error: autonomousRes.error.message }

  const items: SessionHistoryItem[] = []

  for (const s of cabinetRes.data ?? []) {
    items.push({ type: 'cabinet', date: s.date_seance, cabinet: s as CabinetSession })
  }
  for (const s of autonomousRes.data ?? []) {
    items.push({
      type: 'autonomie',
      date: s.created_at,
      autonomous: { ...s, exercices: (s.exercices ?? []) as ExerciceOrdonné[] } as AutonomousSession,
    })
  }
  for (const e of executionsRes.data ?? []) {
    const template = (e as { recurring_templates: RecurringTemplate }).recurring_templates
    // Vérifie que le template appartient bien au coach
    if (template?.coach_id !== user.id) continue
    items.push({
      type: 'recurrente',
      date: e.started_at,
      execution: {
        ...e,
        template: { ...template, exercices: (template.exercices ?? []) as ExerciceOrdonné[] },
      } as RecurringExecution & { template: RecurringTemplate },
    })
  }

  // Tri chronologique inversé
  items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  return { data: items, error: null }
}

// ============================================================
// MÉTRIQUES D'OBSERVANCE (dashboard coach)
// ============================================================

/**
 * Calcule les métriques d'observance globales pour le coach
 */
export async function getSessionsObservanceMetrics(): Promise<{
  data: SessionsObservanceMetrics | null
  error: string | null
}> {
  const { user, error: authError } = await requireCoach()
  if (!user) return { data: null, error: authError }

  await syncOverdueStatuses()

  const admin = createAdminClient()
  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

  const [autonomousRes, cabinetRes] = await Promise.all([
    admin
      .from('autonomous_sessions')
      .select('statut, created_at')
      .eq('coach_id', user.id),
    admin
      .from('cabinet_sessions')
      .select('date_seance, statut')
      .eq('coach_id', user.id)
      .eq('statut', 'realisee')
      .order('date_seance', { ascending: false })
      .limit(1),
  ])

  if (autonomousRes.error) return { data: null, error: autonomousRes.error.message }

  const autonomous = autonomousRes.data ?? []
  const total = autonomous.length
  const terminee = autonomous.filter((s) => s.statut === 'terminee').length
  const en_retard = autonomous.filter((s) => s.statut === 'en_retard').length
  const ce_mois = autonomous.filter((s) => s.created_at >= startOfMonth).length

  return {
    data: {
      taux_completion: total > 0 ? Math.round((terminee / total) * 100) : 0,
      seances_en_retard: en_retard,
      seances_ce_mois: ce_mois,
      derniere_seance_cabinet: cabinetRes.data?.[0]?.date_seance ?? null,
    },
    error: null,
  }
}

// ============================================================
// HELPER : clients du coach pour les selects
// ============================================================

/**
 * Récupère les clients actifs du coach pour les formulaires de séances
 */
export async function getClientsForSelectAction(): Promise<{
  data: ClientSelectOption[]
  error: string | null
}> {
  const { user, error: authError } = await requireCoach()
  if (!user) return { data: [], error: authError }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('clients')
    .select('user_id, nom, prenom')
    .eq('coach_id', user.id)
    .eq('statut', 'actif')
    .order('nom', { ascending: true })

  if (error) return { data: [], error: error.message }

  return {
    data: (data ?? []).map((c) => ({
      id: c.user_id as string,
      nom: c.nom as string,
      prenom: c.prenom as string,
    })),
    error: null,
  }
}

// ============================================================
// Timeline unifiée coach — 3 types de séances avec progression exercices
// ============================================================

export interface ProgrammeTimelineItem {
  id: string
  type: 'cabinet' | 'autonomie' | 'recurrente'
  titre: string
  date: string
  statut: string
  objectif: string | null
  exercices_total: number
  exercices_completes: number
  cabinet?: CabinetSession
  autonomous?: AutonomousSession
  template?: RecurringTemplate
}

/**
 * Retourne la timeline unifiée de toutes les séances d'un client,
 * triées par date décroissante (plus récent en premier).
 * Utilisée par le coach sur la fiche client.
 */
export async function getClientSessionTimelineAction(
  clientUserId: string,
): Promise<{ data: ProgrammeTimelineItem[] | null; error: string | null }> {
  const parsedId = z.string().uuid().safeParse(clientUserId)
  if (!parsedId.success) return { data: null, error: 'ID client invalide' }

  const { user, error: authError } = await requireCoach()
  if (authError || !user) return { data: null, error: authError ?? 'Non authentifié' }

  await syncOverdueStatuses()

  const admin = createAdminClient()

  const [cabinetRes, autonomousRes, templatesRes] = await Promise.all([
    admin
      .from('cabinet_sessions')
      .select('*')
      .eq('coach_id', user.id)
      .eq('client_id', clientUserId)
      .order('date_seance', { ascending: false }),

    admin
      .from('autonomous_sessions')
      .select('*')
      .eq('coach_id', user.id)
      .eq('client_id', clientUserId)
      .order('created_at', { ascending: false }),

    admin
      .from('recurring_templates')
      .select('*, recurring_executions(*)')
      .eq('coach_id', user.id)
      .eq('client_id', clientUserId)
      .eq('is_active', true)
      .order('created_at', { ascending: false }),
  ])

  if (cabinetRes.error)    return { data: null, error: cabinetRes.error.message }
  if (autonomousRes.error) return { data: null, error: autonomousRes.error.message }
  if (templatesRes.error)  return { data: null, error: templatesRes.error.message }

  const cabinetItems: ProgrammeTimelineItem[] = (cabinetRes.data ?? []).map((s) => {
    const exercices = (s.exercices_utilises as ExerciceOrdonné[]) ?? []
    return {
      id:                  s.id,
      type:                'cabinet',
      titre:               s.objectif,
      date:                s.date_seance,
      statut:              s.statut,
      objectif:            s.objectif,
      exercices_total:     exercices.length,
      exercices_completes: exercices.length, // cabinet = tous faits en séance
      cabinet:             s as CabinetSession,
    }
  })

  const autonomousItems: ProgrammeTimelineItem[] = (autonomousRes.data ?? []).map((s) => {
    const exercices = (s.exercices as ExerciceOrdonné[]) ?? []
    return {
      id:                  s.id,
      type:                'autonomie',
      titre:               s.titre,
      date:                (s.date_cible as string | null) ?? s.created_at,
      statut:              s.statut,
      objectif:            s.objectif,
      exercices_total:     exercices.length,
      exercices_completes: s.statut === 'terminee' ? exercices.length : 0,
      autonomous:          s as AutonomousSession,
    }
  })

  const recurringItems: ProgrammeTimelineItem[] = (templatesRes.data ?? []).map((t) => {
    const executions = (t.recurring_executions ?? []) as RecurringExecution[]
    const lastExecution = [...executions].sort(
      (a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime(),
    )[0]
    const exercices = (t.exercices as ExerciceOrdonné[]) ?? []
    return {
      id:                  t.id,
      type:                'recurrente',
      titre:               t.titre,
      date:                lastExecution?.started_at ?? t.created_at,
      statut:              lastExecution?.completed ? 'completee' : 'active',
      objectif:            (t.description as string | null) ?? null,
      exercices_total:     exercices.length,
      exercices_completes: executions.filter((e) => e.completed).length,
      template:            t as RecurringTemplate,
    }
  })

  const timeline = [...cabinetItems, ...autonomousItems, ...recurringItems].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  )

  return { data: timeline, error: null }
}

// ============================================================
// Récupérer les séances brutes d'un client pour le module Programme
// Utilisé pour alimenter AddEtapeDialog (sélection de séances existantes)
// ============================================================

/**
 * Récupère les séances cabinet du client connecté (vue client)
 */
export async function getMyCabinetSessionsAction(): Promise<{
  data: CabinetSession[]
  error: string | null
}> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { data: [], error: 'Non authentifié' }

  const { data, error } = await supabase
    .from('cabinet_sessions')
    .select('*')
    .eq('client_id', user.id)
    .order('date_seance', { ascending: false })

  if (error) return { data: [], error: error.message }
  return { data: (data ?? []) as CabinetSession[], error: null }
}

// ============================================================
// Supprimer une séance (coach uniquement — vérifie coach_id)
// ============================================================

export async function deleteSessionAction(
  id: string,
  type: 'cabinet' | 'autonomie' | 'recurrente',
  clientCrmId: string,
): Promise<{ error: string | null }> {
  const parsedId = z.string().uuid().safeParse(id)
  if (!parsedId.success) return { error: 'Identifiant invalide' }

  const { user, error: authError } = await requireCoach()
  if (authError || !user) return { error: authError ?? 'Non authentifié' }

  const admin = createAdminClient()

  let error: string | null = null

  if (type === 'cabinet') {
    const { error: err } = await admin
      .from('cabinet_sessions')
      .delete()
      .eq('id', parsedId.data)
      .eq('coach_id', user.id)
    error = err?.message ?? null
  } else if (type === 'autonomie') {
    const { error: err } = await admin
      .from('autonomous_sessions')
      .delete()
      .eq('id', parsedId.data)
      .eq('coach_id', user.id)
    error = err?.message ?? null
  } else if (type === 'recurrente') {
    // Soft-delete : désactivation plutôt que suppression (exécutions liées en CASCADE)
    const { error: err } = await admin
      .from('recurring_templates')
      .update({ is_active: false })
      .eq('id', parsedId.data)
      .eq('coach_id', user.id)
    error = err?.message ?? null
  }

  if (!error) {
    const { revalidatePath } = await import('next/cache')
    revalidatePath(`/coach/clients/${clientCrmId}`)
  }

  return { error }
}

export async function getClientSessionsForProgramme(clientUserId: string): Promise<{
  cabinetSessions: CabinetSession[]
  autonomousSessions: AutonomousSession[]
  recurringTemplates: RecurringTemplate[]
  error: string | null
}> {
  const empty = { cabinetSessions: [], autonomousSessions: [], recurringTemplates: [], error: null }

  const parsedId = z.string().uuid().safeParse(clientUserId)
  if (!parsedId.success) return { ...empty, error: 'Identifiant client invalide' }

  const { user, error: authError } = await requireCoach()
  if (authError || !user) return { ...empty, error: authError ?? 'Non authentifié' }

  const admin = createAdminClient()

  const [cabinetRes, autonomousRes, templatesRes] = await Promise.all([
    admin
      .from('cabinet_sessions')
      .select('*')
      .eq('coach_id', user.id)
      .eq('client_id', parsedId.data)
      .order('date_seance', { ascending: false }),
    admin
      .from('autonomous_sessions')
      .select('*')
      .eq('coach_id', user.id)
      .eq('client_id', parsedId.data)
      .order('created_at', { ascending: false }),
    admin
      .from('recurring_templates')
      .select('*')
      .eq('coach_id', user.id)
      .eq('client_id', parsedId.data)
      .eq('is_active', true),
  ])

  return {
    cabinetSessions:   (cabinetRes.data ?? []) as CabinetSession[],
    autonomousSessions: (autonomousRes.data ?? []) as AutonomousSession[],
    recurringTemplates: (templatesRes.data ?? []) as RecurringTemplate[],
    error: cabinetRes.error?.message ?? autonomousRes.error?.message ?? templatesRes.error?.message ?? null,
  }
}
