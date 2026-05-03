'use server'

import { z } from 'zod'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import type {
  Exercise,
  ExerciseQuestion,
  ExerciseResponseItem,
  ExerciseResponseRecord,
  InteractiveExerciseResult,
  BonhommeScores,
  FigureScores,
  FigureNotes,
} from '@/types'

// ============================================================
// Schémas de validation Zod
// ============================================================

const EXERCISE_TYPES = ['bonhomme_performance', 'figure_performance'] as const
const exerciseTypeSchema = z.enum(EXERCISE_TYPES)
const uuidSchema = z.string().uuid('ID invalide')

const score0to100 = z.number().int().min(0).max(100)

// Schéma de données pour le Bonhomme de Performance
const bonhommeDataSchema = z.object({
  mental:      score0to100,
  strategique: score0to100,
  tactique:    score0to100,
  physique:    score0to100,
  hygiene:     score0to100,
  technique:   score0to100,
  relationnel: score0to100,
  global_score: z.number().min(0).max(100),
  completed_at: z.string().datetime(),
}) satisfies z.ZodType<BonhommeScores & { global_score: number; completed_at: string }>

// Schéma de données pour la Figure de Performance
const figureScoresSchema = z.object({
  psycho:    score0to100,
  physique:  score0to100,
  technique: score0to100,
  tactique:  score0to100,
  social:    score0to100,
  materiel:  score0to100,
}) satisfies z.ZodType<FigureScores>

const figureNotesSchema = z.object({
  psycho:    z.string().max(2000),
  physique:  z.string().max(2000),
  technique: z.string().max(2000),
  tactique:  z.string().max(2000),
  social:    z.string().max(2000),
  materiel:  z.string().max(2000),
}) satisfies z.ZodType<FigureNotes>

const figureDataSchema = z.object({
  scores:       figureScoresSchema,
  notes:        figureNotesSchema,
  global_score: z.number().min(0).max(100),
  completed_at: z.string().datetime(),
})

// Validation du payload selon le type d'exercice
function validateExerciseData(
  exerciseType: typeof EXERCISE_TYPES[number],
  data: Record<string, unknown>,
): { success: true; data: Record<string, unknown> } | { success: false; error: string } {
  const schema = exerciseType === 'bonhomme_performance' ? bonhommeDataSchema : figureDataSchema
  const result = schema.safeParse(data)
  if (!result.success) {
    return { success: false, error: `Données invalides : ${result.error.issues[0]?.message ?? 'format incorrect'}` }
  }
  return { success: true, data: result.data as Record<string, unknown> }
}

// ============================================================
// saveInteractiveExerciseAction
// Enregistre un résultat d'exercice interactif (jsonb)
// ============================================================
export async function saveInteractiveExerciseAction(
  exerciseType: string,
  data: Record<string, unknown>,
  clientId?: string,
): Promise<{ error: string | null }> {
  // Validation exerciseType
  const typeResult = exerciseTypeSchema.safeParse(exerciseType)
  if (!typeResult.success) return { error: 'Type d\'exercice invalide' }

  // Validation clientId si fourni
  if (clientId) {
    const idResult = uuidSchema.safeParse(clientId)
    if (!idResult.success) return { error: 'client_id invalide' }
  }

  // Validation du payload selon le type
  const dataValidation = validateExerciseData(typeResult.data, data)
  if (!dataValidation.success) return { error: dataValidation.error }

  // Auth : utilisateur connecté requis
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' }

  const admin = createAdminClient()

  // Parallélisation : rôle + propriété client simultanément
  const [{ data: me }, clientResult] = await Promise.all([
    admin.from('users').select('role').eq('id', user.id).single(),
    clientId
      ? admin.from('clients').select('id, coach_id').eq('id', clientId).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ])

  if (!me || (me.role !== 'coach' && me.role !== 'admin')) {
    return { error: 'Accès réservé aux coachs' }
  }

  if (clientId) {
    const clientData = clientResult.data as { id: string; coach_id: string } | null
    if (!clientData) return { error: 'Client introuvable ou non autorisé' }
    if (me.role !== 'admin' && clientData.coach_id !== user.id) return { error: 'Client introuvable ou non autorisé' }
  }

  const { error: insertError } = await admin
    .from('interactive_exercise_results')
    .insert({
      exercise_type: typeResult.data,
      coach_id:  user.id,
      client_id: clientId ?? null,
      data:      dataValidation.data,
    })

  if (insertError) return { error: `Enregistrement échoué : ${insertError.message}` }
  return { error: null }
}

// ============================================================
// Schémas Zod pour la création d'exercices personnalisés
// ============================================================

const exerciseQuestionTypeSchema = z.enum(['open', 'scale', 'mcq'])

const exerciseQuestionSchema = z.object({
  id:      z.string().min(1),
  type:    exerciseQuestionTypeSchema,
  label:   z.string().min(1).max(500),
  min:     z.number().int().optional(),
  max:     z.number().int().optional(),
  options: z.array(z.string().min(1).max(200)).optional(),
}) satisfies z.ZodType<ExerciseQuestion>

const createExerciseSchema = z.object({
  titre:       z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  categorie:   z.string().min(1).max(100),
  questions:   z.array(exerciseQuestionSchema).min(1).max(50),
})

const exerciseResponseItemSchema = z.object({
  question_id: z.string().min(1),
  type:        exerciseQuestionTypeSchema,
  value:       z.union([z.string(), z.number()]),
}) satisfies z.ZodType<ExerciseResponseItem>

// ============================================================
// createCustomExerciseAction
// Crée un exercice personnalisé avec questions (réservé Expert)
// ============================================================
export async function createCustomExerciseAction(
  formData: unknown,
): Promise<{ data: { id: string } | null; error: string | null }> {
  const parsed = createExerciseSchema.safeParse(formData)
  if (!parsed.success) {
    return { data: null, error: `Données invalides : ${parsed.error.issues[0]?.message ?? 'format incorrect'}` }
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { data: null, error: 'Non authentifié' }

  const admin = createAdminClient()

  // Vérification rôle coach ou admin (tier coach simplifié — un seul abonnement)
  const { data: me } = await admin
    .from('users')
    .select('role, subscription_tier')
    .eq('id', user.id)
    .single()

  if (!me || (me.role !== 'coach' && me.role !== 'admin')) {
    return { data: null, error: 'Accès réservé aux coachs' }
  }
  if (me.role === 'coach' && me.subscription_tier === 'free') {
    return { data: null, error: 'La création d\'exercices personnalisés requiert un abonnement Pro' }
  }

  const { data, error: insertError } = await admin
    .from('exercises')
    .insert({
      titre:       parsed.data.titre,
      description: parsed.data.description ?? null,
      categorie:   parsed.data.categorie,
      format:      'questionnaire' as const,
      is_custom:   true,
      is_public:   false,
      coach_id:    user.id,
      questions:   parsed.data.questions,
    })
    .select('id')
    .single()

  if (insertError) {
    console.error('[createCustomExerciseAction] insert error:', insertError)
    return { data: null, error: 'Création échouée. Veuillez réessayer.' }
  }
  return { data: { id: data.id as string }, error: null }
}

// ============================================================
// getExercisesAction
// Retourne tous les exercices publics + exercices custom du coach
// ============================================================
export async function getExercisesAction(): Promise<{
  data: Exercise[] | null
  error: string | null
}> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const admin = createAdminClient()

  if (user) {
    // Coach/admin : voir les publics + ses propres exercices custom
    const { data, error } = await admin
      .from('exercises')
      .select('*')
      .or(`is_public.eq.true,coach_id.eq.${user.id}`)
      .order('titre')

    if (error) {
      console.error('[getExercisesAction] query error:', error)
      return { data: null, error: 'Erreur lors du chargement des exercices' }
    }
    return { data: data as Exercise[], error: null }
  }

  // Non authentifié : exercices publics seulement
  const { data, error } = await admin
    .from('exercises')
    .select('*')
    .eq('is_public', true)
    .order('titre')

  if (error) {
    console.error('[getExercisesAction] query error:', error)
    return { data: null, error: 'Erreur lors du chargement des exercices' }
  }
  return { data: data as Exercise[], error: null }
}

// ============================================================
// getExerciseAction
// Retourne un exercice par son ID (public ou appartenant au coach connecté)
// ============================================================
export async function getExerciseAction(id: string): Promise<{
  data: Exercise | null
  error: string | null
}> {
  const idResult = uuidSchema.safeParse(id)
  if (!idResult.success) return { data: null, error: 'ID invalide' }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { data: null, error: 'Non authentifié' }

  const admin = createAdminClient()

  // Autorisation : exercice public OU appartenant au coach connecté
  const { data, error } = await admin
    .from('exercises')
    .select('*')
    .eq('id', id)
    .or(`is_public.eq.true,coach_id.eq.${user.id}`)
    .single()

  if (error) return { data: null, error: 'Exercice introuvable ou accès refusé' }
  return { data: data as Exercise, error: null }
}

// ============================================================
// getClientExercisesAction
// Retourne les exercices avec questions pour les clients
// ============================================================
export async function getClientExercisesAction(): Promise<{
  data: Exercise[] | null
  error: string | null
}> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { data: null, error: 'Non authentifié' }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('exercises')
    .select('*')
    .eq('is_public', true)
    .order('titre')

  if (error) {
    console.error('[getClientExercisesAction] query error:', error)
    return { data: null, error: 'Erreur lors du chargement des exercices' }
  }

  // Filtrer côté serveur : garder seulement ceux avec au moins une question
  const withQuestions = (data as Exercise[]).filter(
    ex => Array.isArray(ex.questions) && ex.questions.length > 0,
  )
  return { data: withQuestions, error: null }
}

// ============================================================
// saveExerciseResponseAction
// Enregistre les réponses d'un client à un exercice
// ============================================================
export async function saveExerciseResponseAction(
  exerciseId: string,
  responses: ExerciseResponseItem[],
  sessionId?: string,
  sessionType?: 'autonomous' | 'recurring',
): Promise<{ error: string | null }> {
  const idResult = uuidSchema.safeParse(exerciseId)
  if (!idResult.success) return { error: 'exercise_id invalide' }

  // Validation sessionId si fourni (F5 : validation du paramètre optionnel)
  if (sessionId !== undefined) {
    const sessionIdSchema = z.string().uuid()
    const sessionIdResult = sessionIdSchema.safeParse(sessionId)
    if (!sessionIdResult.success) return { error: 'session_id invalide' }
  }

  const parsedResponses = z.array(exerciseResponseItemSchema).safeParse(responses)
  if (!parsedResponses.success) {
    return { error: 'Réponses invalides : format incorrect' }
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' }

  const admin = createAdminClient()

  const { error: insertError } = await admin
    .from('exercise_responses')
    .insert({
      exercise_id:           exerciseId,
      user_id:               user.id,
      autonomous_session_id: sessionType === 'autonomous' ? (sessionId ?? null) : null,
      recurring_execution_id: sessionType === 'recurring' ? (sessionId ?? null) : null,
      session_type:          sessionType ?? null,
      responses:             parsedResponses.data,
    })

  if (insertError) {
    console.error('[saveExerciseResponseAction] insert error:', insertError)
    return { error: 'Enregistrement échoué. Veuillez réessayer.' }
  }
  return { error: null }
}

// ============================================================
// getExerciseResponsesAction
// Retourne les réponses d'un client (pour le coach)
// ============================================================
export async function getExerciseResponsesAction(
  clientId: string,
  exerciseId?: string,
): Promise<{
  data: (ExerciseResponseRecord & { exercise: Exercise })[] | null
  error: string | null
}> {
  const idResult = uuidSchema.safeParse(clientId)
  if (!idResult.success) return { data: null, error: 'client_id invalide' }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { data: null, error: 'Non authentifié' }

  const admin = createAdminClient()

  // Validation exerciseId si fourni (F6)
  if (exerciseId !== undefined) {
    const exIdResult = uuidSchema.safeParse(exerciseId)
    if (!exIdResult.success) return { data: null, error: 'exercise_id invalide' }
  }

  // Parallélisation : rôle + client lookup simultanément
  const [{ data: me }, { data: clientRow }] = await Promise.all([
    admin.from('users').select('role').eq('id', user.id).single(),
    admin.from('clients').select('user_id, coach_id').eq('id', clientId).maybeSingle(),
  ])

  if (!me || (me.role !== 'coach' && me.role !== 'admin')) {
    return { data: null, error: 'Accès non autorisé' }
  }
  if (!clientRow?.user_id) return { data: null, error: 'Client introuvable ou sans compte utilisateur' }
  if (me.role !== 'admin' && clientRow.coach_id !== user.id) {
    return { data: null, error: 'Accès non autorisé' }
  }

  // Récupérer les réponses
  let responseQuery = admin
    .from('exercise_responses')
    .select('*, exercise:exercises(*)')
    .eq('user_id', clientRow.user_id)
    .order('completed_at', { ascending: false })

  if (exerciseId) {
    responseQuery = responseQuery.eq('exercise_id', exerciseId)
  }

  const { data, error } = await responseQuery

  if (error) {
    console.error('[getExerciseResponsesAction] query error:', error)
    return { data: null, error: 'Erreur lors de la récupération des réponses' }
  }
  return { data: data as (ExerciseResponseRecord & { exercise: Exercise })[], error: null }
}

// ============================================================
// getFigureEvolutionAction
// Retourne les exécutions Figure de Performance pour un client
// ============================================================
export async function getFigureEvolutionAction(clientId: string): Promise<{
  data: InteractiveExerciseResult[] | null
  error: string | null
}> {
  const idResult = uuidSchema.safeParse(clientId)
  if (!idResult.success) return { data: null, error: 'client_id invalide' }

  // Auth : coach connecté requis
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { data: null, error: 'Non authentifié' }

  const admin = createAdminClient()

  // Parallélisation : rôle + propriété client simultanément
  const [{ data: me }, { data: clientRow }] = await Promise.all([
    admin.from('users').select('role').eq('id', user.id).single(),
    admin.from('clients').select('id, coach_id').eq('id', clientId).maybeSingle(),
  ])

  if (!me || (me.role !== 'coach' && me.role !== 'admin')) {
    return { data: null, error: 'Accès non autorisé' }
  }
  if (!clientRow) return { data: null, error: 'Client introuvable ou non autorisé' }
  if (me.role !== 'admin' && clientRow.coach_id !== user.id) {
    return { data: null, error: 'Client introuvable ou non autorisé' }
  }

  const { data, error } = await admin
    .from('interactive_exercise_results')
    .select('*')
    .eq('exercise_type', 'figure_performance')
    .eq('client_id', clientId)
    .order('created_at', { ascending: true })

  if (error) return { data: null, error: error.message }
  return { data: data as InteractiveExerciseResult[], error: null }
}

// ============================================================
// saveClientInteractiveExerciseResultAction
// Enregistre un résultat d'exercice interactif depuis une séance autonomie client
// ============================================================
export async function saveClientInteractiveExerciseResultAction(
  exerciseType: string,
  data: Record<string, unknown>,
  autonomousSessionId: string,
): Promise<{ error: string | null }> {
  const typeResult = exerciseTypeSchema.safeParse(exerciseType)
  if (!typeResult.success) return { error: 'Type d\'exercice invalide' }

  const sessionIdResult = uuidSchema.safeParse(autonomousSessionId)
  if (!sessionIdResult.success) return { error: 'ID de séance invalide' }

  // Validation du payload
  const dataValidation = validateExerciseData(typeResult.data, data)
  if (!dataValidation.success) return { error: dataValidation.error }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' }

  const admin = createAdminClient()

  // Vérifie que la séance appartient bien au client connecté et récupère le coach_id
  const { data: session } = await admin
    .from('autonomous_sessions')
    .select('coach_id, client_id')
    .eq('id', sessionIdResult.data)
    .eq('client_id', user.id)
    .single()

  if (!session) return { error: 'Séance introuvable ou non autorisée' }

  const { error: insertError } = await admin
    .from('interactive_exercise_results')
    .insert({
      exercise_type:         typeResult.data,
      coach_id:              session.coach_id as string,
      client_id:             user.id,
      data:                  dataValidation.data,
      autonomous_session_id: sessionIdResult.data,
    })

  if (insertError) return { error: insertError.message }
  return { error: null }
}

// ============================================================
// getAutonomousSessionResultsForCoachAction
// Retourne les résultats complets d'une séance autonomie pour le coach
// ============================================================
import type { AutonomousSession } from '@/types'

export async function getAutonomousSessionResultsForCoachAction(
  sessionId: string,
  clientCrmId: string,
): Promise<{
  session: AutonomousSession | null
  exerciseResponses: (ExerciseResponseRecord & { exercise: Exercise })[]
  interactiveResults: InteractiveExerciseResult[]
  error: string | null
}> {
  const empty = { session: null, exerciseResponses: [], interactiveResults: [], error: null }

  const parsedSessionId  = uuidSchema.safeParse(sessionId)
  const parsedClientId   = uuidSchema.safeParse(clientCrmId)
  if (!parsedSessionId.success || !parsedClientId.success) {
    return { ...empty, error: 'Identifiants invalides' }
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ...empty, error: 'Non authentifié' }

  const admin = createAdminClient()

  // Vérifie que le coach possède ce client et récupère son user_id
  const { data: clientRow } = await admin
    .from('clients')
    .select('user_id, coach_id')
    .eq('id', parsedClientId.data)
    .eq('coach_id', user.id)
    .single()

  if (!clientRow?.user_id) return { ...empty, error: 'Client introuvable ou non autorisé' }
  const clientUserId = clientRow.user_id as string

  // Fetch session first — needed as time anchor for legacy fallback
  const sessionRes = await admin
    .from('autonomous_sessions')
    .select('*')
    .eq('id', parsedSessionId.data)
    .eq('coach_id', user.id)
    .single()

  if (sessionRes.error) return { ...empty, error: sessionRes.error.message }

  const sessionUpdatedAt = (sessionRes.data as { updated_at?: string }).updated_at
    ?? (sessionRes.data as { created_at?: string }).created_at

  const [responsesRes, interactiveRes] = await Promise.all([
    admin
      .from('exercise_responses')
      .select('*, exercise:exercises(*)')
      .eq('user_id', clientUserId)
      .eq('autonomous_session_id', parsedSessionId.data)
      .order('completed_at', { ascending: true }),
    admin
      .from('interactive_exercise_results')
      .select('*')
      .eq('coach_id', user.id)
      .eq('client_id', clientUserId)
      .eq('autonomous_session_id', parsedSessionId.data)
      .order('created_at', { ascending: true }),
  ])

  // Fallback pour les résultats enregistrés avant l'ajout du FK autonomous_session_id
  let interactiveResults = (interactiveRes.data ?? []) as InteractiveExerciseResult[]
  if (interactiveResults.length === 0 && sessionUpdatedAt) {
    const anchor = new Date(sessionUpdatedAt)
    const from  = new Date(anchor.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
    const to    = new Date(anchor.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString()
    const { data: legacyData } = await admin
      .from('interactive_exercise_results')
      .select('*')
      .eq('coach_id', user.id)
      .eq('client_id', clientUserId)
      .is('autonomous_session_id', null)
      .gte('created_at', from)
      .lte('created_at', to)
      .order('created_at', { ascending: true })
    interactiveResults = (legacyData ?? []) as InteractiveExerciseResult[]
  }

  return {
    session: sessionRes.data as AutonomousSession,
    exerciseResponses: (responsesRes.data ?? []) as (ExerciseResponseRecord & { exercise: Exercise })[],
    interactiveResults,
    error: null,
  }
}
