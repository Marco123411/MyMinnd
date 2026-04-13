'use server'

import { createClient, createAdminClient } from '@/lib/supabase/server'
import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import type {
  Programme,
  ProgrammeAvecEtapes,
  ProgrammeEtapeEnrichie,
  ProgramExercise,
  TypeSeance,
  CabinetSession,
  AutonomousSession,
  RecurringTemplate,
  CognitiveTestDefinition,
} from '@/types'
import { computeProgrammeStats } from '@/lib/programme-utils'

export { computeProgrammeStats }

// ============================================================
// Schémas de validation
// ============================================================

const createProgrammeSchema = z.object({
  client_id:   z.string().uuid(),
  nom:         z.string().min(1, 'Le nom est requis').max(200),
  description: z.string().optional().nullable(),
})

const addEtapeSchema = z.object({
  programme_id:           z.string().uuid(),
  type_seance:            z.enum(['cabinet', 'autonomie', 'recurrente', 'cognitif']),
  cabinet_session_id:     z.string().uuid().optional().nullable(),
  autonomous_session_id:  z.string().uuid().optional().nullable(),
  recurring_template_id:  z.string().uuid().optional().nullable(),
  cognitive_session_id:   z.string().uuid().optional().nullable(),
})

// ============================================================
// Helper auth coach
// ============================================================

async function requireCoach() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { user: null, error: 'Non authentifié' }

  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'coach') return { user: null, error: 'Accès réservé aux coachs' }
  return { user, error: null }
}

// ============================================================
// Helper : enrichir les étapes avec statut de complétion et titre
// Factorisé pour éviter la duplication entre getClientProgrammesAction et getMyProgrammeAction
// ============================================================

type RawEtapeRow = {
  id: string
  programme_id: string
  ordre: number
  type_seance: TypeSeance
  titre: string | null
  cabinet_session_id: string | null
  autonomous_session_id: string | null
  recurring_template_id: string | null
  cognitive_session_id: string | null
  created_at: string
  cabinet_sessions: CabinetSession | null
  autonomous_sessions: AutonomousSession | null
  recurring_templates: RecurringTemplate | null
  cognitive_sessions: {
    id: string
    status: string
    completed_at: string | null
    computed_metrics: Record<string, unknown> | null
    cognitive_test_definitions: { slug: string; name: string } | null
  } | null
  program_exercises?: ProgramExercise[]
}

function enrichEtapes(rawEtapes: RawEtapeRow[]): ProgrammeEtapeEnrichie[] {
  return [...rawEtapes]
    .sort((a, b) => a.ordre - b.ordre)
    .map((etape) => {
      let est_complete = false
      let titre_display = 'Séance'
      let cabinet: CabinetSession | undefined
      let autonomous: AutonomousSession | undefined
      let template: RecurringTemplate | undefined

      let cognitive_session: ProgrammeEtapeEnrichie['cognitive_session'] = null

      if (etape.type_seance === 'cabinet') {
        cabinet = etape.cabinet_sessions ?? undefined
        est_complete = cabinet?.statut === 'realisee'
        titre_display = cabinet?.objectif ?? 'Séance supprimée'
      } else if (etape.type_seance === 'autonomie') {
        autonomous = etape.autonomous_sessions ?? undefined
        est_complete = autonomous?.statut === 'terminee'
        titre_display = autonomous?.titre ?? 'Séance supprimée'
      } else if (etape.type_seance === 'recurrente') {
        template = etape.recurring_templates ?? undefined
        est_complete = false  // récurrents n'ont pas de statut global
        titre_display = template?.titre ?? 'Routine supprimée'
      } else if (etape.type_seance === 'cognitif') {
        if (etape.cognitive_session_id && etape.cognitive_sessions) {
          // Rétrocompatibilité : ancienne étape cognitif avec session unique
          const cs = etape.cognitive_sessions
          const def = Array.isArray(cs.cognitive_test_definitions) ? cs.cognitive_test_definitions[0] : cs.cognitive_test_definitions
          cognitive_session = {
            id:               cs.id,
            status:           cs.status,
            completed_at:     cs.completed_at,
            computed_metrics: cs.computed_metrics,
            test_name:        (def as { name: string } | null)?.name ?? 'Test cognitif',
            test_slug:        (def as { slug: string } | null)?.slug ?? '',
          }
          est_complete = cs.completed_at != null
          titre_display = etape.titre ?? cognitive_session.test_name
        } else {
          // Nouveau modèle : titre libre, drills dans program_exercises
          titre_display = etape.titre ?? 'Séance cognitive'
          const inDrills = (etape.program_exercises ?? []).filter(ex => ex.phase === 'in')
          est_complete = inDrills.length > 0 && inDrills.every(ex => ex.completed_at != null)
        }
      }

      return {
        id:                    etape.id,
        programme_id:          etape.programme_id,
        ordre:                 etape.ordre,
        type_seance:           etape.type_seance,
        titre:                 etape.titre ?? null,
        cabinet_session_id:    etape.cabinet_session_id,
        autonomous_session_id: etape.autonomous_session_id,
        recurring_template_id: etape.recurring_template_id,
        cognitive_session_id:  etape.cognitive_session_id,
        created_at:            etape.created_at,
        cabinet,
        autonomous,
        template,
        cognitive_session,
        est_complete,
        titre_display,
        program_exercises: (etape.program_exercises ?? []) as ProgramExercise[],
      }
    })
}

// ============================================================
// Créer un programme
// ============================================================

export async function createProgrammeAction(
  input: z.infer<typeof createProgrammeSchema>
): Promise<{ data: Programme | null; error: string | null }> {
  const { user, error: authError } = await requireCoach()
  if (authError || !user) return { data: null, error: authError ?? 'Non authentifié' }

  const parsed = createProgrammeSchema.safeParse(input)
  if (!parsed.success) return { data: null, error: parsed.error.issues[0].message }

  const admin = createAdminClient()

  // Vérifier que le client appartient bien à ce coach (même pattern que createCabinetSessionAction)
  const { data: clientRecord } = await admin
    .from('clients')
    .select('id')
    .eq('user_id', parsed.data.client_id)
    .eq('coach_id', user.id)
    .single()

  if (!clientRecord) return { data: null, error: 'Client introuvable ou non autorisé' }

  const { data, error } = await admin
    .from('programmes')
    .insert({
      coach_id:    user.id,
      client_id:   parsed.data.client_id,
      nom:         parsed.data.nom,
      description: parsed.data.description ?? null,
    })
    .select()
    .single()

  if (error) return { data: null, error: error.message }
  // Utiliser l'ID CRM du client (clients.id) pour invalider la bonne route
  revalidatePath(`/coach/clients/${clientRecord.id}`)
  return { data: data as Programme, error: null }
}

// ============================================================
// Récupérer tous les programmes actifs du coach (vue globale)
// ============================================================

export interface ProgrammeListItem {
  id: string
  nom: string
  description: string | null
  statut: 'actif' | 'archive'
  client_id: string
  client_crm_id: string
  client_nom: string
  etapes_total: number
  created_at: string
  archived_at: string | null
}

export async function getAllCoachProgrammesAction(): Promise<{
  data: ProgrammeListItem[] | null
  error: string | null
}> {
  const { user, error: authError } = await requireCoach()
  if (authError || !user) return { data: null, error: authError ?? 'Non authentifié' }

  const admin = createAdminClient()

  const { data: programmes, error } = await admin
    .from('programmes')
    .select('id, nom, description, statut, client_id, created_at, archived_at, programme_etapes(id)')
    .eq('coach_id', user.id)
    .eq('statut', 'actif')
    .order('created_at', { ascending: false })

  if (error) return { data: null, error: error.message }
  if (!programmes || programmes.length === 0) return { data: [], error: null }

  // Récupérer les IDs CRM (table clients) et noms pour chaque client
  const clientUserIds = [...new Set(programmes.map((p) => p.client_id as string))]
  const { data: clientsData } = await admin
    .from('clients')
    .select('id, user_id, nom')
    .in('user_id', clientUserIds)
    .eq('coach_id', user.id)

  const clientMap = new Map<string, { crmId: string; nom: string }>(
    (clientsData ?? []).map((c) => [c.user_id as string, { crmId: c.id as string, nom: c.nom as string }])
  )

  const items: ProgrammeListItem[] = programmes.map((p) => {
    const client = clientMap.get(p.client_id as string)
    return {
      id:            p.id as string,
      nom:           p.nom as string,
      description:   p.description as string | null,
      statut:        p.statut as 'actif' | 'archive',
      client_id:     p.client_id as string,
      client_crm_id: client?.crmId ?? '',
      client_nom:    client?.nom ?? '—',
      etapes_total:  Array.isArray(p.programme_etapes) ? (p.programme_etapes as unknown[]).length : 0,
      created_at:    p.created_at as string,
      archived_at:   null,
    }
  })

  return { data: items, error: null }
}

// ============================================================
// Programmes archivés du coach (+ purge auto des +30j)
// ============================================================

const ARCHIVE_TTL_DAYS = 30

async function fetchAndMapProgrammes(
  admin: ReturnType<typeof createAdminClient>,
  coachId: string,
  statut: 'actif' | 'archive'
): Promise<ProgrammeListItem[]> {
  const { data: programmes } = await admin
    .from('programmes')
    .select('id, nom, description, statut, client_id, created_at, archived_at, programme_etapes(id)')
    .eq('coach_id', coachId)
    .eq('statut', statut)
    .order(statut === 'archive' ? 'archived_at' : 'created_at', { ascending: false })

  if (!programmes || programmes.length === 0) return []

  const clientUserIds = [...new Set(programmes.map((p) => p.client_id as string))]
  const { data: clientsData } = await admin
    .from('clients')
    .select('id, user_id, nom')
    .in('user_id', clientUserIds)
    .eq('coach_id', coachId)

  const clientMap = new Map<string, { crmId: string; nom: string }>(
    (clientsData ?? []).map((c) => [c.user_id as string, { crmId: c.id as string, nom: c.nom as string }])
  )

  return programmes.map((p) => {
    const client = clientMap.get(p.client_id as string)
    return {
      id:            p.id as string,
      nom:           p.nom as string,
      description:   p.description as string | null,
      statut:        p.statut as 'actif' | 'archive',
      client_id:     p.client_id as string,
      client_crm_id: client?.crmId ?? '',
      client_nom:    client?.nom ?? '—',
      etapes_total:  Array.isArray(p.programme_etapes) ? (p.programme_etapes as unknown[]).length : 0,
      created_at:    p.created_at as string,
      archived_at:   (p.archived_at as string | null) ?? null,
    }
  })
}

export async function getArchivedCoachProgrammesAction(): Promise<{
  data: ProgrammeListItem[] | null
  error: string | null
  purgedCount: number
}> {
  const { user, error: authError } = await requireCoach()
  if (authError || !user) return { data: null, error: authError ?? 'Non authentifié', purgedCount: 0 }

  const admin = createAdminClient()

  // Purge automatique : supprimer les archives de +30 jours
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - ARCHIVE_TTL_DAYS)
  const { count: purgedCount } = await admin
    .from('programmes')
    .delete({ count: 'exact' })
    .eq('coach_id', user.id)
    .eq('statut', 'archive')
    .lt('archived_at', cutoff.toISOString())

  const items = await fetchAndMapProgrammes(admin, user.id, 'archive')
  return { data: items, error: null, purgedCount: purgedCount ?? 0 }
}

// ============================================================
// Récupérer le(s) programme(s) actifs d'un client
// ============================================================

export async function getClientProgrammesAction(
  clientUserId: string
): Promise<{ data: ProgrammeAvecEtapes[] | null; error: string | null }> {
  const { user, error: authError } = await requireCoach()
  if (authError || !user) return { data: null, error: authError ?? 'Non authentifié' }

  const admin = createAdminClient()

  const { data: programmes, error } = await admin
    .from('programmes')
    .select(`
      *,
      programme_etapes (
        id, programme_id, ordre, type_seance, titre,
        cabinet_session_id, autonomous_session_id, recurring_template_id, cognitive_session_id,
        created_at,
        cabinet_sessions (*),
        autonomous_sessions (*),
        recurring_templates (*),
        cognitive_sessions!cognitive_session_id (
          id,
          status,
          completed_at,
          computed_metrics,
          cognitive_test_definitions (slug, name)
        ),
        program_exercises (
          id, programme_etape_id, cognitive_test_id, exercise_id, phase,
          configured_duration_sec, configured_intensity_percent,
          cognitive_load_score, display_order, created_at, completed_at,
          cognitive_test_definitions!cognitive_test_id (id, slug, name, base_cognitive_load,
            default_duration_sec, default_intensity_percent, intensity_configurable,
            configurable_durations, phase_tags, instructions_fr, cognitive_category),
          exercises!exercise_id (id, titre, format, description)
        )
      )
    `)
    .eq('coach_id', user.id)
    .eq('client_id', clientUserId)
    .eq('statut', 'actif')
    .order('created_at', { ascending: false })

  if (error) return { data: null, error: error.message }

  const enrichis: ProgrammeAvecEtapes[] = (programmes ?? []).map((prog) => ({
    id:          prog.id as string,
    coach_id:    prog.coach_id as string,
    client_id:   prog.client_id as string,
    nom:         prog.nom as string,
    description: prog.description as string | null,
    statut:      prog.statut as 'actif' | 'archive',
    created_at:  prog.created_at as string,
    updated_at:  prog.updated_at as string,
    etapes: enrichEtapes((prog.programme_etapes ?? []) as RawEtapeRow[]),
  }))

  return { data: enrichis, error: null }
}

// ============================================================
// Ajouter une étape à un programme existant
// ============================================================

export async function addEtapeAction(
  input: z.infer<typeof addEtapeSchema>
): Promise<{ error: string | null }> {
  const { user, error: authError } = await requireCoach()
  if (authError || !user) return { error: authError ?? 'Non authentifié' }

  const parsed = addEtapeSchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  // Vérifier que exactement une FK est fournie
  const fkCount = [
    parsed.data.cabinet_session_id,
    parsed.data.autonomous_session_id,
    parsed.data.recurring_template_id,
    parsed.data.cognitive_session_id,
  ].filter(Boolean).length

  if (fkCount !== 1) return { error: 'Une seule séance doit être liée à chaque étape' }

  const admin = createAdminClient()

  // Vérifier que le programme appartient bien à ce coach et qu'il est actif
  const { data: prog } = await admin
    .from('programmes')
    .select('id, client_id')
    .eq('id', parsed.data.programme_id)
    .eq('coach_id', user.id)
    .eq('statut', 'actif')
    .single()

  if (!prog) return { error: 'Programme introuvable ou archivé' }

  // Utiliser MAX(ordre) pour éviter les race conditions avec COUNT
  const { data: maxOrdreResult } = await admin
    .from('programme_etapes')
    .select('ordre')
    .eq('programme_id', parsed.data.programme_id)
    .order('ordre', { ascending: false })
    .limit(1)
    .maybeSingle()

  const prochain_ordre = ((maxOrdreResult as { ordre: number } | null)?.ordre ?? 0) + 1

  const { error } = await admin
    .from('programme_etapes')
    .insert({
      programme_id:          parsed.data.programme_id,
      ordre:                 prochain_ordre,
      type_seance:           parsed.data.type_seance,
      cabinet_session_id:    parsed.data.cabinet_session_id ?? null,
      autonomous_session_id: parsed.data.autonomous_session_id ?? null,
      recurring_template_id: parsed.data.recurring_template_id ?? null,
      cognitive_session_id:  parsed.data.cognitive_session_id ?? null,
    })

  if (error) return { error: error.message }

  revalidatePath(`/coach/clients/${prog.client_id}`)
  return { error: null }
}

// ============================================================
// Créer une séance ET l'ajouter au programme en une seule action
// ============================================================

const createCabinetEtapeSchema = z.object({
  programme_id: z.string().uuid(),
  objectif:     z.string().min(1, "L'objectif est requis"),
  date_seance:  z.string().min(1, 'La date est requise'),
  contenu:      z.string().optional(),
})

const createAutonomeEtapeSchema = z.object({
  programme_id: z.string().uuid(),
  titre:        z.string().min(1, 'Le titre est requis'),
  objectif:     z.string().min(1, "L'objectif est requis"),
  date_cible:   z.string().optional().nullable(),
})

const createRecurrenteEtapeSchema = z.object({
  programme_id: z.string().uuid(),
  titre:        z.string().min(1, 'Le titre est requis'),
  description:  z.string().optional(),
})

const createCognitifEtapeSchema = z.object({
  programme_id: z.string().uuid(),
  titre:        z.string().min(1, 'Le titre est obligatoire').max(200),
})

export async function createAndAddEtapeAction(
  type: TypeSeance,
  data: Record<string, unknown>
): Promise<{ error: string | null }> {
  const { user, error: authError } = await requireCoach()
  if (authError || !user) return { error: authError ?? 'Non authentifié' }

  const parsedProgrammeId = z.string().uuid().safeParse(data.programme_id)
  if (!parsedProgrammeId.success) return { error: 'programme_id invalide' }

  const admin = createAdminClient()

  // Vérifier que le programme appartient à ce coach et est actif
  const { data: prog } = await admin
    .from('programmes')
    .select('id, client_id')
    .eq('id', parsedProgrammeId.data)
    .eq('coach_id', user.id)
    .eq('statut', 'actif')
    .single()

  if (!prog) return { error: 'Programme introuvable ou archivé' }

  const clientUserId = prog.client_id as string

  // Créer la séance selon le type et récupérer son ID
  let newSessionId: string
  let sessionTable: 'cabinet_sessions' | 'autonomous_sessions' | 'recurring_templates' | 'cognitive_sessions'

  if (type === 'cabinet') {
    const parsed = createCabinetEtapeSchema.safeParse(data)
    if (!parsed.success) return { error: parsed.error.issues[0].message }

    const { data: session, error } = await admin
      .from('cabinet_sessions')
      .insert({
        coach_id:           user.id,
        client_id:          clientUserId,
        date_seance:        parsed.data.date_seance,
        objectif:           parsed.data.objectif,
        exercices_utilises: [],
        contenu:            parsed.data.contenu ?? null,
      })
      .select('id')
      .single()

    if (error || !session) return { error: error?.message ?? 'Erreur création séance' }
    newSessionId = session.id as string
    sessionTable = 'cabinet_sessions'

  } else if (type === 'autonomie') {
    const parsed = createAutonomeEtapeSchema.safeParse(data)
    if (!parsed.success) return { error: parsed.error.issues[0].message }

    const { data: session, error } = await admin
      .from('autonomous_sessions')
      .insert({
        coach_id:   user.id,
        client_id:  clientUserId,
        titre:      parsed.data.titre,
        objectif:   parsed.data.objectif,
        exercices:  [],
        date_cible: parsed.data.date_cible ?? null,
      })
      .select('id')
      .single()

    if (error || !session) return { error: error?.message ?? 'Erreur création séance' }
    newSessionId = session.id as string
    sessionTable = 'autonomous_sessions'

  } else if (type === 'recurrente') {
    const parsed = createRecurrenteEtapeSchema.safeParse(data)
    if (!parsed.success) return { error: parsed.error.issues[0].message }

    const { data: session, error } = await admin
      .from('recurring_templates')
      .insert({
        coach_id:    user.id,
        client_id:   clientUserId,
        titre:       parsed.data.titre,
        description: parsed.data.description ?? null,
        exercices:   [],
      })
      .select('id')
      .single()

    if (error || !session) return { error: error?.message ?? 'Erreur création routine' }
    newSessionId = session.id as string
    sessionTable = 'recurring_templates'

  } else if (type === 'cognitif') {
    const parsed = createCognitifEtapeSchema.safeParse(data)
    if (!parsed.success) return { error: parsed.error.issues[0].message }

    // Calcul de l'ordre
    const { data: maxOrdreResult } = await admin
      .from('programme_etapes')
      .select('ordre')
      .eq('programme_id', parsedProgrammeId.data)
      .order('ordre', { ascending: false })
      .limit(1)
      .maybeSingle()

    const prochain_ordre = ((maxOrdreResult as { ordre: number } | null)?.ordre ?? 0) + 1

    // Insertion directe de l'étape — pas de session à créer
    const { error: etapeError } = await admin
      .from('programme_etapes')
      .insert({
        programme_id:          parsedProgrammeId.data,
        ordre:                 prochain_ordre,
        type_seance:           'cognitif',
        titre:                 parsed.data.titre,
        cabinet_session_id:    null,
        autonomous_session_id: null,
        recurring_template_id: null,
        cognitive_session_id:  null,
      })

    if (etapeError) return { error: etapeError.message ?? 'Erreur création étape cognitive' }

    revalidatePath(`/coach/clients/${clientUserId}`)
    return { error: null }

  } else {
    return { error: 'Type de séance invalide' }
  }

  // Utiliser MAX(ordre) pour éviter les race conditions
  const { data: maxOrdreResult } = await admin
    .from('programme_etapes')
    .select('ordre')
    .eq('programme_id', parsedProgrammeId.data)
    .order('ordre', { ascending: false })
    .limit(1)
    .maybeSingle()

  const prochain_ordre = ((maxOrdreResult as { ordre: number } | null)?.ordre ?? 0) + 1

  // Insérer l'étape avec la FK de la séance nouvellement créée
  const { data: newEtape, error: etapeError } = await admin
    .from('programme_etapes')
    .insert({
      programme_id:          parsedProgrammeId.data,
      ordre:                 prochain_ordre,
      type_seance:           type,
      cabinet_session_id:    type === 'cabinet'    ? newSessionId : null,
      autonomous_session_id: type === 'autonomie'  ? newSessionId : null,
      recurring_template_id: type === 'recurrente' ? newSessionId : null,
      cognitive_session_id:  null,
    })
    .select('id')
    .single()

  if (etapeError || !newEtape) {
    // Rollback manuel : supprimer la séance créée si l'étape échoue
    await admin.from(sessionTable).delete().eq('id', newSessionId)
    return { error: etapeError?.message ?? 'Erreur création étape' }
  }

  revalidatePath(`/coach/clients/${clientUserId}`)
  return { error: null }
}

// ============================================================
// Supprimer une étape (et réordonner les suivantes)
// ============================================================

export async function removeEtapeAction(
  etapeId: string,
  programmeId: string
): Promise<{ error: string | null }> {
  const parsedEtapeId = z.string().uuid().safeParse(etapeId)
  const parsedProgId  = z.string().uuid().safeParse(programmeId)
  if (!parsedEtapeId.success || !parsedProgId.success) return { error: 'Identifiants invalides' }

  const { user, error: authError } = await requireCoach()
  if (authError || !user) return { error: authError ?? 'Non authentifié' }

  const admin = createAdminClient()

  // Vérifier propriété du programme
  const { data: prog } = await admin
    .from('programmes')
    .select('id, client_id')
    .eq('id', parsedProgId.data)
    .eq('coach_id', user.id)
    .single()

  if (!prog) return { error: 'Programme introuvable' }

  // Supprimer l'étape
  const { data: deleted, error: delError } = await admin
    .from('programme_etapes')
    .delete()
    .eq('id', parsedEtapeId.data)
    .eq('programme_id', parsedProgId.data)
    .select('ordre')
    .single()

  if (delError) return { error: delError.message }

  // Réordonner les étapes suivantes (ordre -= 1)
  if (deleted) {
    const { error: rpcError } = await admin.rpc('reorder_programme_etapes_after_delete', {
      p_programme_id:  parsedProgId.data,
      p_deleted_ordre: (deleted as { ordre: number }).ordre,
    })
    if (rpcError) return { error: `Étape supprimée mais réordonnancement échoué : ${rpcError.message}` }
  }

  revalidatePath(`/coach/clients/${prog.client_id}`)
  return { error: null }
}

// ============================================================
// Archiver un programme
// ============================================================

export async function archiveProgrammeAction(
  programmeId: string
): Promise<{ error: string | null }> {
  const parsedId = z.string().uuid().safeParse(programmeId)
  if (!parsedId.success) return { error: 'Identifiant invalide' }

  const { user, error: authError } = await requireCoach()
  if (authError || !user) return { error: authError ?? 'Non authentifié' }

  const admin = createAdminClient()

  const { data: prog, error } = await admin
    .from('programmes')
    .update({ statut: 'archive' })
    .eq('id', parsedId.data)
    .eq('coach_id', user.id)
    .eq('statut', 'actif')
    .select('client_id')
    .single()

  if (error) return { error: error.message }

  revalidatePath(`/coach/clients/${prog.client_id}`)
  return { error: null }
}

// ============================================================
// Vue client : programme actif du client connecté
// ============================================================

export async function getMyProgrammeAction(): Promise<{
  data: ProgrammeAvecEtapes | null
  error: string | null
}> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { data: null, error: 'Non authentifié' }

  const admin = createAdminClient()

  const { data, error } = await admin
    .from('programmes')
    .select(`
      *,
      programme_etapes (
        id, programme_id, ordre, type_seance, titre,
        cabinet_session_id, autonomous_session_id, recurring_template_id, cognitive_session_id,
        created_at,
        cabinet_sessions (*),
        autonomous_sessions (*),
        recurring_templates (*),
        cognitive_sessions!cognitive_session_id (
          id,
          status,
          completed_at,
          computed_metrics,
          cognitive_test_definitions (slug, name)
        ),
        program_exercises (
          id, programme_etape_id, cognitive_test_id, exercise_id, phase,
          configured_duration_sec, configured_intensity_percent,
          cognitive_load_score, display_order, created_at, completed_at,
          cognitive_test_definitions!cognitive_test_id (id, slug, name, base_cognitive_load,
            default_duration_sec, default_intensity_percent, intensity_configurable,
            configurable_durations, phase_tags, instructions_fr, cognitive_category),
          exercises!exercise_id (id, titre, format, description)
        )
      )
    `)
    .eq('client_id', user.id)
    .eq('statut', 'actif')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) return { data: null, error: error.message }
  if (!data) return { data: null, error: null }

  const programme: ProgrammeAvecEtapes = {
    id:          data.id as string,
    coach_id:    data.coach_id as string,
    client_id:   data.client_id as string,
    nom:         data.nom as string,
    description: data.description as string | null,
    statut:      data.statut as 'actif' | 'archive',
    created_at:  data.created_at as string,
    updated_at:  data.updated_at as string,
    etapes: enrichEtapes((data.programme_etapes ?? []) as RawEtapeRow[]),
  }

  return { data: programme, error: null }
}

// ============================================================
// Drills cognitifs — actions COACH (ajout, config, suppression, phase)
// ============================================================

// Récupère tous les tests cognitifs actifs pour le sélecteur de drills
export async function getCognitiveTestDefinitionsAction(): Promise<{
  data: CognitiveTestDefinition[]
  error: string | null
}> {
  const { user, error: authError } = await requireCoach()
  if (authError || !user) return { data: [], error: authError ?? 'Non authentifié' }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('cognitive_test_definitions')
    .select('*')
    .eq('is_active', true)
    .order('name')

  if (error) return { data: [], error: error.message }
  return { data: (data ?? []) as CognitiveTestDefinition[], error: null }
}

const addDrillSchema = z.object({
  etape_id:                  z.string().uuid(),
  cognitive_test_id:         z.string().uuid(),
  phase:                     z.enum(['pre', 'in', 'post']),
  configured_duration_sec:   z.number().int().positive(),
  configured_intensity_percent: z.number().int().min(10).max(100),
  cognitive_load_score:      z.number().int().min(1).max(26),
})

// Ajoute un drill cognitif à une étape de programme (coach only)
export async function addDrillToEtapeAction(
  input: z.infer<typeof addDrillSchema>
): Promise<{ data: ProgramExercise | null; error: string | null }> {
  const { user, error: authError } = await requireCoach()
  if (authError || !user) return { data: null, error: authError ?? 'Non authentifié' }

  const parsed = addDrillSchema.safeParse(input)
  if (!parsed.success) return { data: null, error: parsed.error.issues[0].message }

  const admin = createAdminClient()

  // Vérifier que l'étape appartient à un programme de ce coach
  const { data: etape } = await admin
    .from('programme_etapes')
    .select('id, programmes!inner(coach_id, client_id)')
    .eq('id', parsed.data.etape_id)
    .eq('programmes.coach_id', user.id)
    .single()

  if (!etape) return { data: null, error: 'Étape introuvable ou non autorisée' }

  // Prochain display_order
  const { count } = await admin
    .from('program_exercises')
    .select('id', { count: 'exact', head: true })
    .eq('programme_etape_id', parsed.data.etape_id)
    .eq('phase', parsed.data.phase)

  const { data, error } = await admin
    .from('program_exercises')
    .insert({
      programme_etape_id:           parsed.data.etape_id,
      cognitive_test_id:            parsed.data.cognitive_test_id,
      phase:                        parsed.data.phase,
      configured_duration_sec:      parsed.data.configured_duration_sec,
      configured_intensity_percent: parsed.data.configured_intensity_percent,
      cognitive_load_score:         parsed.data.cognitive_load_score,
      display_order:                count ?? 0,
    })
    .select('*, cognitive_test_definitions(*)')
    .single()

  if (error) return { data: null, error: error.message }

  const prog = (etape.programmes as unknown as { client_id: string }[] | { client_id: string })
  const clientId = Array.isArray(prog) ? prog[0]?.client_id : prog?.client_id
  if (clientId) revalidatePath(`/coach/clients/${clientId}`)

  return { data: data as unknown as ProgramExercise, error: null }
}

const updateDrillSchema = z.object({
  drill_id:                     z.string().uuid(),
  phase:                        z.enum(['pre', 'in', 'post']).optional(),
  configured_duration_sec:      z.number().int().positive().optional(),
  configured_intensity_percent: z.number().int().min(10).max(100).optional(),
  cognitive_load_score:         z.number().int().min(1).max(26).optional(),
})

// Met à jour la config d'un drill (phase, durée, intensité)
export async function updateDrillAction(
  input: z.infer<typeof updateDrillSchema>
): Promise<{ error: string | null }> {
  const { user, error: authError } = await requireCoach()
  if (authError || !user) return { error: authError ?? 'Non authentifié' }

  const parsed = updateDrillSchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const admin = createAdminClient()

  // Vérifier ownership via la chaîne programme_etapes → programmes
  const { data: drill } = await admin
    .from('program_exercises')
    .select(`
      id,
      programme_etapes!inner (
        programmes!inner ( coach_id, client_id )
      )
    `)
    .eq('id', parsed.data.drill_id)
    .eq('programme_etapes.programmes.coach_id', user.id)
    .single()

  if (!drill) return { error: 'Drill introuvable ou non autorisé' }

  const updates: Record<string, unknown> = {}
  if (parsed.data.phase !== undefined)                        updates.phase = parsed.data.phase
  if (parsed.data.configured_duration_sec !== undefined)      updates.configured_duration_sec = parsed.data.configured_duration_sec
  if (parsed.data.configured_intensity_percent !== undefined) updates.configured_intensity_percent = parsed.data.configured_intensity_percent
  if (parsed.data.cognitive_load_score !== undefined)         updates.cognitive_load_score = parsed.data.cognitive_load_score

  const { error } = await admin
    .from('program_exercises')
    .update(updates)
    .eq('id', parsed.data.drill_id)

  if (error) return { error: error.message }

  const etapeData = drill.programme_etapes as unknown as { programmes: { client_id: string }[] | { client_id: string } }
  const prog = etapeData?.programmes
  const clientId = Array.isArray(prog) ? prog[0]?.client_id : prog?.client_id
  if (clientId) revalidatePath(`/coach/clients/${clientId}`)

  return { error: null }
}

// Supprime un drill
export async function deleteDrillAction(
  drillId: string
): Promise<{ error: string | null }> {
  const parsedId = z.string().uuid().safeParse(drillId)
  if (!parsedId.success) return { error: 'Identifiant invalide' }

  const { user, error: authError } = await requireCoach()
  if (authError || !user) return { error: authError ?? 'Non authentifié' }

  const admin = createAdminClient()

  const { data: drill } = await admin
    .from('program_exercises')
    .select(`
      id,
      programme_etapes!inner (
        programmes!inner ( coach_id, client_id )
      )
    `)
    .eq('id', parsedId.data)
    .eq('programme_etapes.programmes.coach_id', user.id)
    .single()

  if (!drill) return { error: 'Drill introuvable ou non autorisé' }

  const { error } = await admin
    .from('program_exercises')
    .delete()
    .eq('id', parsedId.data)

  if (error) return { error: error.message }

  const etapeData = drill.programme_etapes as unknown as { programmes: { client_id: string }[] | { client_id: string } }
  const prog = etapeData?.programmes
  const clientId = Array.isArray(prog) ? prog[0]?.client_id : prog?.client_id
  if (clientId) revalidatePath(`/coach/clients/${clientId}`)

  return { error: null }
}

// ============================================================
// Exercices bibliothèque — ajout à une étape non-cognitive (Pre/In/Post)
// ============================================================

const addExerciseSchema = z.object({
  etape_id:    z.string().uuid(),
  exercise_id: z.string().uuid(),
  phase:       z.enum(['pre', 'in', 'post']),
})

export async function addExerciseToEtapeAction(
  input: z.infer<typeof addExerciseSchema>
): Promise<{ data: ProgramExercise | null; error: string | null }> {
  const { user, error: authError } = await requireCoach()
  if (authError || !user) return { data: null, error: authError ?? 'Non authentifié' }

  const parsed = addExerciseSchema.safeParse(input)
  if (!parsed.success) return { data: null, error: parsed.error.issues[0].message }

  const admin = createAdminClient()

  // Vérifier ownership de l'étape
  const { data: etape } = await admin
    .from('programme_etapes')
    .select('id, programmes!inner(coach_id, client_id)')
    .eq('id', parsed.data.etape_id)
    .eq('programmes.coach_id', user.id)
    .single()

  if (!etape) return { data: null, error: 'Étape introuvable ou non autorisée' }

  // Vérifier que l'exercice existe et est accessible (propriétaire ou public)
  const { data: exercise } = await admin
    .from('exercises')
    .select('id')
    .eq('id', parsed.data.exercise_id)
    .or(`coach_id.eq.${user.id},is_public.eq.true`)
    .single()

  if (!exercise) return { data: null, error: 'Exercice introuvable ou non autorisé' }

  // Prochain display_order dans la phase
  const { count } = await admin
    .from('program_exercises')
    .select('id', { count: 'exact', head: true })
    .eq('programme_etape_id', parsed.data.etape_id)
    .eq('phase', parsed.data.phase)

  const { data, error } = await admin
    .from('program_exercises')
    .insert({
      programme_etape_id: parsed.data.etape_id,
      exercise_id:        parsed.data.exercise_id,
      cognitive_test_id:  null,
      phase:              parsed.data.phase,
      display_order:      count ?? 0,
    })
    .select('*, exercises!exercise_id(id, titre, format, description)')
    .single()

  if (error) return { data: null, error: error.message }

  const prog = (etape.programmes as unknown as { client_id: string }[] | { client_id: string })
  const clientId = Array.isArray(prog) ? prog[0]?.client_id : prog?.client_id
  if (clientId) revalidatePath(`/coach/clients/${clientId}`)

  return { data: data as unknown as ProgramExercise, error: null }
}

// ============================================================
// Exercices cognitifs de programme (client)
// ============================================================

// Charge un program_exercise avec sa définition de test cognitif
// Vérifie que le programme appartient au client connecté
export async function getProgramExerciseAction(
  id: string
): Promise<{ data: ProgramExercise | null; error: string | null }> {
  const parsedId = z.string().uuid().safeParse(id)
  if (!parsedId.success) return { data: null, error: 'Identifiant invalide' }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { data: null, error: 'Non authentifié' }

  const admin = createAdminClient()

  const { data, error } = await admin
    .from('program_exercises')
    .select(`
      *,
      cognitive_test_definitions (*),
      programme_etapes!inner (
        programme_id,
        programmes!inner ( client_id )
      )
    `)
    .eq('id', parsedId.data)
    .eq('programme_etapes.programmes.client_id', user.id)
    .single()

  if (error || !data) return { data: null, error: error?.message ?? 'Exercice introuvable' }

  return { data: data as unknown as ProgramExercise, error: null }
}

// Marque un program_exercise comme complété par le client
export async function markProgramExerciseCompleteAction(
  programExerciseId: string
): Promise<{ error: string | null }> {
  const parsedId = z.string().uuid().safeParse(programExerciseId)
  if (!parsedId.success) return { error: 'Identifiant invalide' }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' }

  const admin = createAdminClient()

  // Vérifier ownership avant mise à jour
  const { data: exercise } = await admin
    .from('program_exercises')
    .select(`
      id,
      programme_etapes!inner (
        programmes!inner ( client_id )
      )
    `)
    .eq('id', parsedId.data)
    .eq('programme_etapes.programmes.client_id', user.id)
    .single()

  if (!exercise) return { error: 'Exercice introuvable ou non autorisé' }

  const { error } = await admin
    .from('program_exercises')
    .update({ completed_at: new Date().toISOString() })
    .eq('id', parsedId.data)

  if (error) return { error: error.message }

  revalidatePath('/client/programme')
  return { error: null }
}
