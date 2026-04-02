'use server'

import { createClient, createAdminClient } from '@/lib/supabase/server'
import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import type {
  Programme,
  ProgrammeAvecEtapes,
  ProgrammeEtapeEnrichie,
  TypeSeance,
  CabinetSession,
  AutonomousSession,
  RecurringTemplate,
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
  programme_id:          z.string().uuid(),
  type_seance:           z.enum(['cabinet', 'autonomie', 'recurrente']),
  cabinet_session_id:    z.string().uuid().optional().nullable(),
  autonomous_session_id: z.string().uuid().optional().nullable(),
  recurring_template_id: z.string().uuid().optional().nullable(),
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
  cabinet_session_id: string | null
  autonomous_session_id: string | null
  recurring_template_id: string | null
  created_at: string
  cabinet_sessions: CabinetSession | null
  autonomous_sessions: AutonomousSession | null
  recurring_templates: RecurringTemplate | null
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
      }

      return {
        id:                    etape.id,
        programme_id:          etape.programme_id,
        ordre:                 etape.ordre,
        type_seance:           etape.type_seance,
        cabinet_session_id:    etape.cabinet_session_id,
        autonomous_session_id: etape.autonomous_session_id,
        recurring_template_id: etape.recurring_template_id,
        created_at:            etape.created_at,
        cabinet,
        autonomous,
        template,
        est_complete,
        titre_display,
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
  revalidatePath(`/coach/clients/${parsed.data.client_id}`)
  return { data: data as Programme, error: null }
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
        *,
        cabinet_sessions (*),
        autonomous_sessions (*),
        recurring_templates (*)
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
    })

  if (error) return { error: error.message }

  revalidatePath(`/coach/clients/${prog.client_id}`)
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
        *,
        cabinet_sessions (*),
        autonomous_sessions (*),
        recurring_templates (*)
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
